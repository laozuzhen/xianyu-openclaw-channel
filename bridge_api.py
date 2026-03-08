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
    # 如果是 default，返回第一个可用实例
    if account_id == "default":
        if not xianyu_instances:
            raise HTTPException(status_code=404, detail="No XianyuLive instances registered")
        # 返回第一个可用实例
        account_id = list(xianyu_instances.keys())[0]
        logger.info(f"[Bridge] default 账号映射到: {account_id}")

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
    logger.info(f"[Bridge] 收到发送请求: accountId={body.accountId}, cid={body.conversationId}, to={body.toUserId}, text={body.text[:30] if len(body.text) > 30 else body.text}")
    try:
        instance = _get_instance(body.accountId)
        logger.info(f"[Bridge] 找到实例，ws={instance.ws is not None}, 准备发送...")
        await instance.send_msg(instance.ws, body.conversationId, body.toUserId, body.text)
        logger.info(f"[Bridge] 消息发送完成")
        return {"ok": True}
    except HTTPException as e:
        logger.error(f"[Bridge] HTTP异常: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[Bridge] 发送文本消息失败: {e}")
        import traceback
        logger.error(f"[Bridge] 堆栈: {traceback.format_exc()}")
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
# ---------------------------------------------------------------------------
# AI Product API - 商品管理
# ---------------------------------------------------------------------------

class CreateProductRequest(BaseModel):
    accountId: Optional[str] = "default"
    title: str
    price: float
    description: Optional[str] = ""
    images: Optional[list] = []
    stock: Optional[int] = 1
    categoryId: Optional[str] = None


@bridge_router.post("/products")
async def create_product(body: CreateProductRequest):
    """创建闲鱼商品"""
    try:
        # TODO: 调用 XianyuLive 的商品创建功能
        logger.info(f"[Bridge] 创建商品: accountId={body.accountId}, title={body.title}, price={body.price}")
        return {"ok": True, "productId": "pending", "status": "created", "message": "Product creation endpoint ready"}
    except Exception as e:
        logger.error(f"[Bridge] 创建商品失败: {e}")
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# 商品发布 API - 使用 product_publisher.py
# ---------------------------------------------------------------------------

class PublishSingleProductRequest(BaseModel):
    cookie_id: str
    title: Optional[str] = None
    description: str
    price: float
    images: list[str]
    category: Optional[str] = None
    location: Optional[str] = None
    original_price: Optional[float] = None
    stock: Optional[int] = 1


class PublishBatchProductsRequest(BaseModel):
    cookie_id: str
    products: list[dict]


@bridge_router.post("/publish/single")
async def publish_single_product(body: PublishSingleProductRequest):
    """
    发布单个商品到闲鱼
    
    Args:
        body: 商品发布请求
            - cookie_id: 账号 Cookie ID（必填）
            - title: 商品标题（可选，默认"AI 生成标题"）
            - description: 商品描述（必填）
            - price: 商品价格（必填，单位：元）
            - images: 图片路径列表（必填，支持本地路径）
            - category: 商品分类（可选，如：数码产品/手机/苹果）
            - location: 发货地（可选，如：北京市/朝阳区）
            - original_price: 原价（可选）
            - stock: 库存数量（可选，默认1）
    
    Returns:
        {
            "ok": True/False,
            "product_id": "商品ID",
            "product_url": "商品链接",
            "error": "错误信息"（如果失败）
        }
    
    Example:
        ```json
        {
            "cookie_id": "user123",
            "title": "iPhone 15 Pro Max",
            "description": "全新未拆封，国行正品",
            "price": 8999,
            "images": ["/path/to/image1.jpg", "/path/to/image2.jpg"],
            "category": "数码产品/手机/苹果",
            "location": "北京市/朝阳区",
            "original_price": 9999,
            "stock": 1
        }
        ```
    
    注意事项:
        - Cookie 必须有效且包含 unb 和 _m_h5_tk 字段
        - 图片必须是本地文件路径（不支持 URL）
        - 价格单位为元（人民币）
        - 图片数量建议 3-9 张
        - 如果图片上传失败率超过 30%，发布将被终止
    """
    try:
        from product_publisher import XianyuProductPublisher, ProductInfo
        import cookie_manager
        
        logger.info(f"[Bridge] 发布单个商品: cookie_id={body.cookie_id}, title={body.title}, price={body.price}")
        
        # 获取 Cookie - 使用 db_manager 直接获取
        import db_manager
        account_info = db_manager.db_manager.get_cookie_by_id(body.cookie_id)
        if not account_info:
            return {"ok": False, "error": f"Cookie not found for account '{body.cookie_id}'"}
        
        cookies_str = account_info.get('value', '')
        if not cookies_str:
            return {"ok": False, "error": f"Cookie value is empty for account '{body.cookie_id}'"}
        
        # 【修复】验证 Cookie 有效性
        # 1. 验证 Cookie 格式
        if ';' not in cookies_str or '=' not in cookies_str:
            return {"ok": False, "error": f"Invalid cookie format for account '{body.cookie_id}'"}
        
        # 2. 验证 Cookie 是否包含必要的字段
        try:
            cookie_dict = {}
            for item in cookies_str.split(';'):
                item = item.strip()
                if '=' in item:
                    key, value = item.split('=', 1)
                    cookie_dict[key.strip()] = value.strip()
            
            required_keys = ['unb', '_m_h5_tk']
            missing_keys = [key for key in required_keys if key not in cookie_dict]
            if missing_keys:
                return {"ok": False, "error": f"Cookie missing required keys: {', '.join(missing_keys)}"}
            
            logger.info(f"[Bridge] Cookie 验证通过: cookie_id={body.cookie_id}")
        except Exception as e:
            logger.error(f"[Bridge] Cookie 验证失败: {e}")
            return {"ok": False, "error": f"Cookie validation failed: {str(e)}"}
        
        # 【修复】检查是否已发布过相同商品（根据标题+价格+描述的哈希值）
        import hashlib
        product_content = f"{body.title or 'AI 生成标题'}{body.price}{body.description}"
        product_hash = hashlib.md5(product_content.encode('utf-8')).hexdigest()
        
        import db_manager
        existing_product = db_manager.db_manager.get_product_by_hash(
            cookie_id=body.cookie_id,
            product_hash=product_hash
        )
        
        if existing_product:
            logger.warning(f"[Bridge] 商品已存在: {existing_product['product_id']}")
            return {
                "ok": False,
                "error": "商品已发布过（标题、价格、描述完全相同）",
                "existing_product_id": existing_product['product_id'],
                "existing_product_url": existing_product['product_url'],
                "published_at": existing_product['published_at']
            }
        
        # 创建商品信息
        product = ProductInfo(
            title=body.title or "AI 生成标题",
            description=body.description,
            price=body.price,
            images=body.images,
            category=body.category,
            location=body.location,
            original_price=body.original_price,
            stock=body.stock
        )
        
        # 初始化发布器
        publisher = XianyuProductPublisher(
            cookie_id=body.cookie_id,
            cookies_str=cookies_str,
            headless=True
        )
        
        # 初始化浏览器
        await publisher.init_browser()
        
        # 登录
        login_success = await publisher.login_with_cookie()
        if not login_success:
            await publisher.close()
            return {"ok": False, "error": "Cookie login failed"}
        
        # 发布商品
        success, product_id, product_url = await publisher.publish_product(product)
        
        # 关闭浏览器
        await publisher.close()
        
        if success:
            # 【修复】保存商品信息到数据库（包含哈希值）
            try:
                import db_manager
                # 获取用户ID（默认为1，实际应该从认证系统获取）
                user_id = 1  # TODO: 从认证系统获取真实用户ID
                db_manager.db_manager.save_published_product_with_hash(
                    user_id=user_id,
                    cookie_id=body.cookie_id,
                    product_id=product_id,
                    product_url=product_url,
                    title=product.title or "AI 生成标题",
                    price=product.price,
                    product_hash=product_hash
                )
                logger.info(f"[Bridge] 商品信息已保存到数据库: product_id={product_id}, hash={product_hash[:8]}...")
            except Exception as e:
                logger.error(f"[Bridge] 保存商品信息失败: {e}")
                # 不影响发布结果，继续返回成功
            
            return {
                "ok": True,
                "product_id": product_id,
                "product_url": product_url
            }
        else:
            return {"ok": False, "error": "Product publish failed"}
            
    except Exception as e:
        logger.error(f"[Bridge] 发布单个商品失败: {e}")
        import traceback
        logger.error(f"[Bridge] 堆栈: {traceback.format_exc()}")
        return {"ok": False, "error": str(e)}


@bridge_router.post("/publish/batch-stream")
async def publish_batch_products_stream(body: PublishBatchProductsRequest):
    """
    批量发布商品到闲鱼（流式响应，支持实时进度）
    
    使用 Server-Sent Events (SSE) 推送发布进度，客户端可以实时了解每个商品的发布状态。
    
    Args:
        body: 批量发布请求（同 /publish/batch）
    
    Returns:
        SSE 流，每个事件包含：
        - event: 事件类型（init/start/progress/complete/done/error）
        - data: JSON 格式的事件数据
    
    事件类型:
        - init: 初始化（返回总数）
        - start: 开始发布某个商品
        - progress: 发布进度更新
        - complete: 某个商品发布完成
        - done: 所有商品发布完成
        - error: 发生错误
    
    Example:
        客户端使用 EventSource 连接：
        ```javascript
        const eventSource = new EventSource('/api/publish/batch-stream');
        eventSource.addEventListener('message', (e) => {
            const data = JSON.parse(e.data);
            console.log(data.event, data.data);
        });
        ```
    """
    from fastapi.responses import StreamingResponse
    import json
    
    async def event_generator():
        try:
            from product_publisher import XianyuProductPublisher, ProductInfo
            import db_manager
            
            # 获取 Cookie - 使用 db_manager 直接获取
            account_info = db_manager.db_manager.get_cookie_by_id(body.cookie_id)
            if not account_info:
                yield f"data: {json.dumps({'event': 'error', 'data': {'error': f'Cookie not found for account {body.cookie_id}'}})}\n\n"
                return
            
            cookies_str = account_info.get('value', '')
            if not cookies_str:
                yield f"data: {json.dumps({'event': 'error', 'data': {'error': 'Cookie value is empty'}})}\n\n"
                return
            
            # 初始化
            yield f"data: {json.dumps({'event': 'init', 'data': {'total': len(body.products)}})}\n\n"
            
            # 初始化发布器
            publisher = XianyuProductPublisher(
                cookie_id=body.cookie_id,
                cookies_str=cookies_str,
                headless=True
            )
            
            # 设置进度回调
            def progress_callback(event: str, data: dict):
                # 注意：这是同步回调，不能直接 yield
                pass
            
            publisher.set_progress_callback(progress_callback)
            
            # 初始化浏览器
            await publisher.init_browser()
            
            # 登录
            login_success = await publisher.login_with_cookie()
            if not login_success:
                await publisher.close()
                yield f"data: {json.dumps({'event': 'error', 'data': {'error': 'Cookie login failed'}})}\n\n"
                return
            
            # 批量发布
            results = []
            success_count = 0
            failed_count = 0
            
            for i, product_data in enumerate(body.products):
                try:
                    # 发送开始事件
                    yield f"data: {json.dumps({'event': 'start', 'data': {'index': i, 'title': product_data.get('title', f'商品 {i+1}')}})}\n\n"
                    
                    product = ProductInfo(
                        title=product_data.get('title', f"AI 生成标题 {i+1}"),
                        description=product_data.get('description', ''),
                        price=product_data.get('price', 0),
                        images=product_data.get('images', []),
                        category=product_data.get('category'),
                        location=product_data.get('location'),
                        original_price=product_data.get('original_price'),
                        stock=product_data.get('stock', 1)
                    )
                    
                    success, product_id, product_url = await publisher.publish_product(product)
                    
                    if success:
                        results.append({
                            "success": True,
                            "product_id": product_id,
                            "product_url": product_url
                        })
                        success_count += 1
                        
                        # 发送完成事件
                        yield f"data: {json.dumps({'event': 'complete', 'data': {'index': i, 'success': True, 'product_id': product_id, 'product_url': product_url}})}\n\n"
                    else:
                        results.append({
                            "success": False,
                            "error": "Publish failed"
                        })
                        failed_count += 1
                        
                        # 发送完成事件
                        yield f"data: {json.dumps({'event': 'complete', 'data': {'index': i, 'success': False, 'error': 'Publish failed'}})}\n\n"
                        
                except Exception as e:
                    logger.error(f"[Bridge] 发布第 {i+1} 个商品失败: {e}")
                    results.append({
                        "success": False,
                        "error": str(e)
                    })
                    failed_count += 1
                    
                    # 发送完成事件
                    yield f"data: {json.dumps({'event': 'complete', 'data': {'index': i, 'success': False, 'error': str(e)}})}\n\n"
            
            # 关闭浏览器
            await publisher.close()
            
            # 发送完成事件
            yield f"data: {json.dumps({'event': 'done', 'data': {'total': len(body.products), 'success_count': success_count, 'failed_count': failed_count, 'results': results}})}\n\n"
            
        except Exception as e:
            logger.error(f"[Bridge] 批量发布流式响应失败: {e}")
            yield f"data: {json.dumps({'event': 'error', 'data': {'error': str(e)}})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@bridge_router.post("/publish/batch")
async def publish_batch_products(body: PublishBatchProductsRequest):
    """
    批量发布商品到闲鱼
    
    Args:
        body: 批量发布请求
            - cookie_id: 账号 Cookie ID（必填）
            - products: 商品列表（必填），每个商品包含：
                - title: 商品标题（可选）
                - description: 商品描述（必填）
                - price: 商品价格（必填）
                - images: 图片路径列表（必填）
                - category: 商品分类（可选）
                - location: 发货地（可选）
                - original_price: 原价（可选）
                - stock: 库存数量（可选）
    
    Returns:
        {
            "ok": True/False,
            "results": [发布结果列表],
            "total": 总数,
            "success_count": 成功数,
            "failed_count": 失败数,
            "error": "错误信息"（如果失败）
        }
    
    Example:
        ```json
        {
            "cookie_id": "user123",
            "products": [
                {
                    "title": "iPhone 15 Pro Max",
                    "description": "全新未拆封",
                    "price": 8999,
                    "images": ["/path/to/image1.jpg"]
                },
                {
                    "title": "MacBook Pro",
                    "description": "M3 芯片",
                    "price": 15999,
                    "images": ["/path/to/image2.jpg"]
                }
            ]
        }
        ```
    
    注意事项:
        - 批量发布会依次发布每个商品
        - 单个商品失败不会影响其他商品
        - 建议每批不超过 10 个商品
        - 发布过程可能需要较长时间，请耐心等待
    """
    try:
        from product_publisher import XianyuProductPublisher, ProductInfo
        import cookie_manager
        
        logger.info(f"[Bridge] 批量发布商品: cookie_id={body.cookie_id}, count={len(body.products)}")
        
        # 获取 Cookie - 使用 db_manager 直接获取
        import db_manager
        account_info = db_manager.db_manager.get_cookie_by_id(body.cookie_id)
        if not account_info:
            return {"ok": False, "error": f"Cookie not found for account '{body.cookie_id}'"}
        
        cookies_str = account_info.get('value', '')
        if not cookies_str:
            return {"ok": False, "error": f"Cookie value is empty for account '{body.cookie_id}'"}
        
        # 初始化发布器
        publisher = XianyuProductPublisher(
            cookie_id=body.cookie_id,
            cookies_str=cookies_str,
            headless=True
        )
        
        # 初始化浏览器
        await publisher.init_browser()
        
        # 登录
        login_success = await publisher.login_with_cookie()
        if not login_success:
            await publisher.close()
            return {"ok": False, "error": "Cookie login failed"}
        
        # 批量发布
        results = []
        success_count = 0
        failed_count = 0
        
        for i, product_data in enumerate(body.products):
            try:
                product = ProductInfo(
                    title=product_data.get('title', f"AI 生成标题 {i+1}"),
                    description=product_data.get('description', ''),
                    price=product_data.get('price', 0),
                    images=product_data.get('images', []),
                    category=product_data.get('category'),
                    location=product_data.get('location'),
                    original_price=product_data.get('original_price'),
                    stock=product_data.get('stock', 1)
                )
                
                success, product_id, product_url = await publisher.publish_product(product)
                
                if success:
                    # 保存商品信息到数据库
                    try:
                        import db_manager
                        user_id = 1  # TODO: 从认证系统获取真实用户ID
                        db_manager.db_manager.save_published_product_info(
                            user_id=user_id,
                            cookie_id=body.cookie_id,
                            product_id=product_id,
                            product_url=product_url,
                            title=product.title,
                            price=product.price
                        )
                    except Exception as e:
                        logger.error(f"[Bridge] 保存商品信息失败: {e}")
                    
                    results.append({
                        "success": True,
                        "product_id": product_id,
                        "product_url": product_url
                    })
                    success_count += 1
                else:
                    results.append({
                        "success": False,
                        "error": "Publish failed"
                    })
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"[Bridge] 发布第 {i+1} 个商品失败: {e}")
                results.append({
                    "success": False,
                    "error": str(e)
                })
                failed_count += 1
        
        # 关闭浏览器
        await publisher.close()
        
        return {
            "ok": True,
            "results": results,
            "total": len(body.products),
            "success_count": success_count,
            "failed_count": failed_count
        }
        
    except Exception as e:
        logger.error(f"[Bridge] 批量发布商品失败: {e}")
        import traceback
        logger.error(f"[Bridge] 堆栈: {traceback.format_exc()}")
        return {"ok": False, "error": str(e)}


@bridge_router.get("/products")
async def list_products(accountId: str = "default", page: int = 1, limit: int = 20):
    """列出闲鱼商品"""
    try:
        # TODO: 从数据库获取商品列表
        logger.info(f"[Bridge] 列出商品: accountId={accountId}, page={page}, limit={limit}")
        return {"ok": True, "products": [], "total": 0, "message": "Product listing endpoint ready"}
    except Exception as e:
        logger.error(f"[Bridge] 列出商品失败: {e}")
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# AI Product API - 发货规则
# ---------------------------------------------------------------------------

class CreateDeliveryRuleRequest(BaseModel):
    accountId: Optional[str] = "default"
    keyword: str
    cardId: int
    enabled: Optional[bool] = True


@bridge_router.post("/delivery-rules")
async def create_delivery_rule(body: CreateDeliveryRuleRequest):
    """创建自动发货规则"""
    try:
        import db_manager
        rule_id = db_manager.add_delivery_rule(body.accountId, body.keyword, body.cardId, body.enabled)
        logger.info(f"[Bridge] 创建发货规则: accountId={body.accountId}, keyword={body.keyword}, cardId={body.cardId}")
        return {"ok": True, "ruleId": rule_id}
    except Exception as e:
        logger.error(f"[Bridge] 创建发货规则失败: {e}")
        return {"ok": False, "error": str(e)}


@bridge_router.get("/delivery-rules")
async def list_delivery_rules(accountId: str = "default"):
    """列出自动发货规则"""
    try:
        import db_manager
        rules = db_manager.get_delivery_rules(accountId)
        return {"ok": True, "rules": rules}
    except Exception as e:
        logger.error(f"[Bridge] 列出发货规则失败: {e}")
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# AI Product API - 发货卡片
# ---------------------------------------------------------------------------

class CreateCardRequest(BaseModel):
    accountId: Optional[str] = "default"
    name: str
    type: str  # text, image, api
    content: str
    delaySeconds: Optional[int] = 0


@bridge_router.post("/cards")
async def create_card(body: CreateCardRequest):
    """创建发货内容卡片"""
    try:
        import db_manager
        card_id = db_manager.add_card(body.accountId, body.name, body.type, body.content, body.delaySeconds)
        logger.info(f"[Bridge] 创建发货卡片: accountId={body.accountId}, name={body.name}, type={body.type}")
        return {"ok": True, "cardId": card_id}
    except Exception as e:
        logger.error(f"[Bridge] 创建发货卡片失败: {e}")
        return {"ok": False, "error": str(e)}


@bridge_router.get("/cards")
async def list_cards(accountId: str = "default"):
    """列出发货卡片"""
    try:
        import db_manager
        cards = db_manager.get_cards(accountId)
        return {"ok": True, "cards": cards}
    except Exception as e:
        logger.error(f"[Bridge] 列出发货卡片失败: {e}")
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Spider API - 商品搜索爬虫
# ---------------------------------------------------------------------------

class SearchProductsRequest(BaseModel):
    """商品搜索请求"""
    cookie_id: str
    keyword: str
    max_pages: Optional[int] = 1


class SearchProductsMultiRequest(BaseModel):
    """多页商品搜索请求"""
    cookie_id: str
    keyword: str
    max_pages: int = 5


@bridge_router.post("/spider/search")
async def search_products(body: SearchProductsRequest):
    """搜索闲鱼商品（单页）
    
    Args:
        body: 搜索请求参数
            - cookie_id: 账号Cookie ID
            - keyword: 搜索关键词
            - max_pages: 最大页数（默认1）
    
    Returns:
        {
            "ok": True/False,
            "keyword": "搜索关键词",
            "total_results": 总结果数,
            "new_records": 新增记录数,
            "new_record_ids": [新增记录ID列表],
            "error": "错误信息"（如果失败）
        }
    """
    try:
        from cookie_manager import manager as cookie_manager
        from product_spider import search_xianyu_products
        
        # 获取Cookie
        cookie_value = cookie_manager.cookies.get(body.cookie_id)
        if not cookie_value:
            logger.error(f"[Bridge] Cookie不存在: {body.cookie_id}")
            return {"ok": False, "error": f"Cookie不存在: {body.cookie_id}"}
        
        logger.info(f"[Bridge] 开始搜索商品: cookie_id={body.cookie_id}, keyword={body.keyword}, max_pages={body.max_pages}")
        
        # 执行搜索
        total_results, new_records, new_ids = await search_xianyu_products(
            cookie_id=body.cookie_id,
            cookies_str=cookie_value,
            keyword=body.keyword,
            max_pages=body.max_pages,
            headless=True
        )
        
        logger.info(f"[Bridge] 搜索完成: keyword={body.keyword}, total={total_results}, new={new_records}")
        
        return {
            "ok": True,
            "keyword": body.keyword,
            "total_results": total_results,
            "new_records": new_records,
            "new_record_ids": new_ids
        }
        
    except Exception as e:
        logger.error(f"[Bridge] 搜索商品失败: {e}")
        import traceback
        logger.error(f"[Bridge] 错误堆栈:\n{traceback.format_exc()}")
        return {"ok": False, "error": str(e)}


@bridge_router.post("/spider/search-multi")
async def search_products_multi(body: SearchProductsMultiRequest):
    """搜索闲鱼商品（多页）
    
    Args:
        body: 搜索请求参数
            - cookie_id: 账号Cookie ID
            - keyword: 搜索关键词
            - max_pages: 最大页数
    
    Returns:
        {
            "ok": True/False,
            "keyword": "搜索关键词",
            "total_results": 总结果数,
            "new_records": 新增记录数,
            "new_record_ids": [新增记录ID列表],
            "error": "错误信息"（如果失败）
        }
    """
    try:
        from cookie_manager import manager as cookie_manager
        from product_spider import search_xianyu_products
        
        # 获取Cookie
        cookie_value = cookie_manager.cookies.get(body.cookie_id)
        if not cookie_value:
            logger.error(f"[Bridge] Cookie不存在: {body.cookie_id}")
            return {"ok": False, "error": f"Cookie不存在: {body.cookie_id}"}
        
        logger.info(f"[Bridge] 开始多页搜索商品: cookie_id={body.cookie_id}, keyword={body.keyword}, max_pages={body.max_pages}")
        
        # 执行搜索
        total_results, new_records, new_ids = await search_xianyu_products(
            cookie_id=body.cookie_id,
            cookies_str=cookie_value,
            keyword=body.keyword,
            max_pages=body.max_pages,
            headless=True
        )
        
        logger.info(f"[Bridge] 多页搜索完成: keyword={body.keyword}, total={total_results}, new={new_records}")
        
        return {
            "ok": True,
            "keyword": body.keyword,
            "total_results": total_results,
            "new_records": new_records,
            "new_record_ids": new_ids
        }
        
    except Exception as e:
        logger.error(f"[Bridge] 多页搜索商品失败: {e}")
        import traceback
        logger.error(f"[Bridge] 错误堆栈:\n{traceback.format_exc()}")
        return {"ok": False, "error": str(e)}


@bridge_router.get("/spider/products")
async def get_spider_products(page: int = 1, limit: int = 20):
    """获取爬虫商品列表
    
    Args:
        page: 页码（从1开始）
        limit: 每页数量
    
    Returns:
        {
            "ok": True/False,
            "products": [商品列表],
            "total": 总数,
            "page": 当前页,
            "limit": 每页数量,
            "error": "错误信息"（如果失败）
        }
    """
    try:
        from db_manager import db_manager
        
        offset = (page - 1) * limit
        products = db_manager.get_spider_products(limit=limit, offset=offset)
        total = db_manager.count_spider_products()
        
        logger.info(f"[Bridge] 获取爬虫商品列表: page={page}, limit={limit}, total={total}")
        
        return {
            "ok": True,
            "products": products,
            "total": total,
            "page": page,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"[Bridge] 获取爬虫商品列表失败: {e}")
        return {"ok": False, "error": str(e)}
