import time
from typing import Dict, Any

def format_message(message_data: Dict[str, Any], is_outgoing: bool = False, is_manual: bool = False) -> str:
    """格式化消息输出"""
    try:
        # 获取消息内容
        content = message_data.get('content', '')
        if not content:
            return ''
            
        # 获取发送时间
        timestamp = message_data.get('time', time.time() * 1000)
        time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp / 1000))
        
        # 确定消息方向
        direction = '【发出】' if is_outgoing else '【收到】'
        if is_manual:
            direction = '【手动发出】'
            
        # 格式化输出
        return f"{time_str} {direction} {content}"
    except Exception as e:
        return f"消息格式化错误: {str(e)}"

def format_system_message(message: str) -> str:
    """格式化系统消息输出"""
    time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
    return f"{time_str} 【系统】 {message}" 