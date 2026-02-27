"""
Bridge 消息队列模块

使用 asyncio.Queue 实现发布-订阅模式，支持多订阅者和断线重连消息补发。
每个账号维护独立的订阅者列表和消息缓冲区。
"""

import asyncio
import threading
from collections import deque
from typing import Optional

from loguru import logger


class BridgeMessageQueue:
    """每个账号维护一个 asyncio.Queue 列表，用于 SSE 推送"""

    BUFFER_MAX_SIZE = 100  # 每个账号的消息缓冲区上限

    def __init__(self):
        self._queues: dict[str, list[asyncio.Queue]] = {}  # account_id -> [subscriber queues]
        self._message_buffer: dict[str, deque] = {}  # account_id -> recent messages (for reconnect)
        self._event_counter: int = 0  # 全局递增事件 ID
        self._lock = threading.Lock()  # 保护 _queues 和 _message_buffer 的并发访问

    def _next_event_id(self) -> str:
        """生成递增的事件 ID"""
        self._event_counter += 1
        return str(self._event_counter)

    def subscribe(self, account_id: str) -> asyncio.Queue:
        """创建新的订阅者队列并添加到订阅者列表"""
        queue: asyncio.Queue = asyncio.Queue()
        with self._lock:
            if account_id not in self._queues:
                self._queues[account_id] = []
            self._queues[account_id].append(queue)
        logger.debug(f"[Bridge] 新订阅者加入 account={account_id}, 当前订阅者数={len(self._queues[account_id])}")
        return queue

    def unsubscribe(self, account_id: str, queue: asyncio.Queue):
        """从订阅者列表移除指定队列"""
        with self._lock:
            subscribers = self._queues.get(account_id, [])
            if queue in subscribers:
                subscribers.remove(queue)
                logger.debug(f"[Bridge] 订阅者离开 account={account_id}, 剩余订阅者数={len(subscribers)}")
            if not subscribers:
                self._queues.pop(account_id, None)

    async def publish(self, account_id: str, message: dict):
        """发布消息到所有订阅者，同时存入缓冲区"""
        event_id = self._next_event_id()
        message["event_id"] = event_id

        # 存入缓冲区
        with self._lock:
            if account_id not in self._message_buffer:
                self._message_buffer[account_id] = deque(maxlen=self.BUFFER_MAX_SIZE)
            self._message_buffer[account_id].append(message)

            subscribers = list(self._queues.get(account_id, []))

        # 推送到所有订阅者队列
        for q in subscribers:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning(f"[Bridge] 订阅者队列已满，丢弃消息 event_id={event_id} account={account_id}")

        logger.debug(f"[Bridge] 消息已发布 event_id={event_id} account={account_id} 订阅者数={len(subscribers)}")

    def get_missed_messages(self, account_id: str, last_event_id: str) -> list[dict]:
        """获取断线期间的未送达消息（last_event_id 之后的所有消息）"""
        with self._lock:
            buffer = self._message_buffer.get(account_id, deque())
            missed = []
            found = False
            for msg in buffer:
                if found:
                    missed.append(msg)
                elif msg.get("event_id") == last_event_id:
                    found = True

            # 如果 last_event_id 不在缓冲区中（可能已被淘汰），返回全部缓冲消息
            if not found and last_event_id:
                missed = list(buffer)

            return missed

    def get_subscriber_count(self, account_id: str) -> int:
        """获取指定账号的订阅者数量"""
        with self._lock:
            return len(self._queues.get(account_id, []))

    def get_total_subscriber_count(self) -> int:
        """获取所有账号的总订阅者数量"""
        with self._lock:
            return sum(len(subs) for subs in self._queues.values())

    def get_buffer_size(self, account_id: str) -> int:
        """获取指定账号的缓冲区消息数量"""
        with self._lock:
            return len(self._message_buffer.get(account_id, deque()))

    def get_total_buffer_size(self) -> int:
        """获取所有账号的总缓冲区消息数量"""
        with self._lock:
            return sum(len(buf) for buf in self._message_buffer.values())


# 全局单例
bridge_queue = BridgeMessageQueue()
