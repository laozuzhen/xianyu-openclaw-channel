"""
Bridge API — FastAPI Router

提供 HTTP/SSE 接口，供 OpenClaw Channel_Plugin 与闲鱼 XianyuLive 实例通信。
"""

import asyncio
import json
import os
import time
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

from bridge_message_queue import bridge_queue

# ---------------------------------------------------------------------------
# XianyuLive 实例注册表
# ---------------------------------------------------------------------------
# XianyuLive 实例在 _run_xianyu 中创建，CookieManager 不保存引用。
# 通过 register_xianyu_instance / unregister_xianyu_instance 在实例生命周期中注册。

xianyu_instances: dict = {}  # account_id -> XianyuLive instance


def register_xianyu_instance(account_id: str, instance):
    """注册 XianyuLive 实例（在 XianyuLive.main 启动时调用）"""
    xianyu_instances[account_id] = instance
    logger.info(f"[Bridge] XianyuLive 实例已注册: {account_id}")


def unregister_xianyu_instance(account_id: str):
    """注销 XianyuLive 实例（在 XianyuLive.main 退出时调用）"""
    xianyu_instances.pop(account_id, None)
    logger.info(f"[Bridge] XianyuLive 实例已注销: {account_id}")


# ---------------------------------------------------------------------------
# Pydantic 请求模型
# ---------------------------------------------------------------------------

class SendMessageRequest(BaseModel):
    conversationId: str
    toUserId: str
    text: str
    accountId: Optional[str] = "default"


class SendMediaRequest(BaseModel):
    conversationId: str
    toUserId: str
    imageUrl: str
    accountId: Optional[str] = "default"


class ConfirmDeliveryRequest(BaseModel):
    orderId: str
    accountId: Optional[str] = "default"


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

bridge_router = APIRouter(prefix="/api/bridge", tags=["bridge"])


# ---------------------------------------------------------------------------
# SSE 消息推送  GET /api/bridge/messages
# ---------------------------------------------------------------------------

@bridge_router.get("/messages")
async def stream_messages(
    request: Request,
    account_id: str = "default",
    last_event_id: Optional[str] = Header(None, alias="Last-Event-ID"),
):
    """SSE 端点：持续推送指定账号的入站消息"""

    queue = bridge_queue.subscribe(account_id)

    async def event_generator():
        try:
            # 如果有 Last-Event-ID，先补发断线期间的消息
            if last_event_id:
                missed = bridge_queue.get_missed_messages(account_id, last_event_id)
                for msg in missed:
                    eid = msg.get("event_id", "")
                    data = json.dumps(msg, ensure_ascii=False)
                    yield f"id: {eid}\nevent: message\ndata: {data}\n\n"

            # 持续监听队列
            while True:
                # 检查客户端是否断开
                if await request.is_disconnected():
                    break

                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                    eid = msg.get("event_id", "")
                    data = json.dumps(msg, ensure_ascii=False)
                    yield f"id: {eid}\nevent: message\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    # 30 秒无消息，发送心跳保持连接
                    yield ": keepalive\n\n"
        finally:
            bridge_queue.unsubscribe(account_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# 辅助：获取 XianyuLive 实例
# ---------------------------------------------------------------------------

def _get_instance(account_id: str):
    """获取 XianyuLive 实例，不存在或 ws 断开时抛出对应 HTTP 异常"""
    instance = xianyu_instances.get(account_id)
    if instance is None:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found or not running")
    if instance.ws is None:
        raise HTTPException(status_code=503, detail=f"Account '{account_id}' WebSocket disconnected")
    return instance


# ---------------------------------------------------------------------------
# 发送文本消息  POST /api/bridge/send
# ---------------------------------------------------------------------------

@bridge_router.post("/send")
async def send_message(body: SendMessageRequest):
    """通过 XianyuLive WebSocket 发送文本消息"""
    try:
        instance = _get_instance(body.accountId)
        await instance.send_msg(instance.ws, body.conversationId, body.toUserId, body.text)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bridge] 发送文本消息失败: {e}")
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# 发送图片消息  POST /api/bridge/send-media
# ---------------------------------------------------------------------------

@bridge_router.post("/send-media")
async def send_media(body: SendMediaRequest):
    """通过 XianyuLive WebSocket 发送图片消息"""
    try:
        instance = _get_instance(body.accountId)
        await instance.send_image_msg(instance.ws, body.conversationId, body.toUserId, body.imageUrl)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bridge] 发送图片消息失败: {e}")
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# 获取账号列表  GET /api/bridge/accounts
# ---------------------------------------------------------------------------

@bridge_router.get("/accounts")
async def get_accounts():
    """返回所有已注册的闲鱼账号信息"""
    import cookie_manager

    accounts = []
    mgr = cookie_manager.manager
    if mgr is not None:
        for cid in mgr.list_cookies():
            instance = xianyu_instances.get(cid)
            accounts.append({
                "accountId": cid,
                "name": cid,
                "enabled": mgr.get_cookie_status(cid),
                "connected": instance is not None and instance.ws is not None,
            })
    return accounts


# ---------------------------------------------------------------------------
# 获取状态  GET /api/bridge/status
# ---------------------------------------------------------------------------

@bridge_router.get("/status")
async def get_status():
    """返回桥接服务的整体运行状态"""
    import cookie_manager

    mgr = cookie_manager.manager
    accounts = []
    if mgr is not None:
        for cid in mgr.list_cookies():
            instance = xianyu_instances.get(cid)
            accounts.append({
                "accountId": cid,
                "name": cid,
                "enabled": mgr.get_cookie_status(cid),
                "connected": instance is not None and instance.ws is not None,
            })

    active_connections = sum(1 for a in accounts if a["connected"])

    return {
        "running": True,
        "activeConnections": active_connections,
        "messageQueueSize": bridge_queue.get_total_buffer_size(),
        "accounts": accounts,
    }


# ---------------------------------------------------------------------------
# 确认发货  POST /api/bridge/confirm-delivery
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 确认发货  POST /api/bridge/confirm-delivery
# ---------------------------------------------------------------------------

@bridge_router.post("/confirm-delivery")
async def confirm_delivery(body: ConfirmDeliveryRequest):
    """调用 XianyuLive 的发货确认功能"""
    try:
        instance = _get_instance(body.accountId)
        result = await instance.auto_confirm(body.orderId)
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bridge] 确认发货失败: {e}")
        return {"ok": False, "error": str(e)}


# ----------------------------------------------------------------------------
# 刷新Cookie  POST /api/bridge/refresh-cookie
# ----------------------------------------------------------------------------

class RefreshCookieRequest(BaseModel):
    accountId: Optional[str] = "default"


@bridge_router.post("/refresh-cookie")
async def refresh_cookie(body: RefreshCookieRequest):
    """手动触发Cookie刷新，从数据库重新加载最新Cookie"""
    try:
        instance = xianyu_instances.get(body.accountId)
        if instance is None:
            raise HTTPException(status_code=404, detail=f"Account '{body.accountId}' not found")
        
        # 从数据库获取最新Cookie
        from cookie_manager import manager as cookie_manager
        account_info = cookie_manager.get_cookie(body.accountId)
        if not account_info:
            raise HTTPException(status_code=404, detail=f"Cookie not found for account '{body.accountId}'")
        
        db_cookie_value = account_info.get('cookie_value', '')
        if db_cookie_value and db_cookie_value != instance.cookies_str:
            instance.cookies_str = db_cookie_value
            from utils.trans_cookies import trans_cookies
            instance.cookies = trans_cookies(instance.cookies_str)
            # 更新 myid
            if 'unb' in instance.cookies:
                instance.myid = instance.cookies['unb']
            logger.info(f"[Bridge] 账号 {body.accountId} Cookie已刷新, new myid: {instance.myid}")
            return {"ok": True, "message": f"Cookie refreshed for account {body.accountId}", "new_myid": instance.myid}
        else:
            return {"ok": True, "message": "Cookie unchanged, no refresh needed", "myid": instance.myid}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bridge] 刷新Cookie失败: {e}")
        return {"ok": False, "error": str(e)}
async def confirm_delivery(body: ConfirmDeliveryRequest):
    """调用 XianyuLive 的发货确认功能"""
    try:
        instance = _get_instance(body.accountId)
        result = await instance.auto_confirm(body.orderId)
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bridge] 确认发货失败: {e}")
        return {"ok": False, "error": str(e)}
