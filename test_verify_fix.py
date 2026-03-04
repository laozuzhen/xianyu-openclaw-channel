"""
测试商品发布成功验证修复

用于验证 _verify_publish_success 函数的修复是否有效
"""

import asyncio
from product_publisher import XianyuProductPublisher, ProductInfo
from loguru import logger

async def test_verify_logic():
    """测试验证逻辑"""
    
    # 模拟测试数据
    cookie_id = "test_account"
    cookies_str = "test_cookie=test_value"
    
    # 创建发布器实例
    publisher = XianyuProductPublisher(
        cookie_id=cookie_id,
        cookies_str=cookies_str,
        headless=False  # 使用有头模式便于观察
    )
    
    try:
        # 初始化浏览器
        await publisher.init_browser()
        
        # 模拟访问一个商品详情页（测试验证逻辑）
        test_urls = [
            "https://www.goofish.com/item.htm?id=123456",  # 标准格式
            "https://www.goofish.com/item/123456",         # 可能的格式
        ]
        
        for url in test_urls:
            logger.info(f"测试 URL: {url}")
            try:
                await publisher.page.goto(url, wait_until='networkidle', timeout=10000)
                await asyncio.sleep(2)
                
                # 测试验证函数
                result = await publisher._verify_publish_success()
                logger.info(f"验证结果: {'成功' if result else '失败'}")
                
            except Exception as e:
                logger.warning(f"访问 URL 失败: {e}")
        
        logger.info("测试完成")
        
    except Exception as e:
        logger.error(f"测试失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
    
    finally:
        await publisher.close()

if __name__ == "__main__":
    asyncio.run(test_verify_logic())
