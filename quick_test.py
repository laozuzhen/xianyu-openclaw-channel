"""
快速测试脚本

用于快速验证商品发布功能是否正常
"""

import asyncio
import argparse
import sys
from pathlib import Path
from product_publisher import XianyuProductPublisher, ProductInfo
from loguru import logger


async def quick_test(
    cookie_id: str,
    cookies_str: str,
    title: str,
    price: float,
    images: list,
    description: str = None,
    headless: bool = True
):
    """快速测试商品发布
    
    Args:
        cookie_id: 账号ID
        cookies_str: Cookie 字符串
        title: 商品标题
        price: 商品价格
        images: 图片路径列表
        description: 商品描述
        headless: 是否无头模式
    """
    logger.info("=" * 60)
    logger.info("🚀 闲鱼商品发布快速测试")
    logger.info("=" * 60)
    
    # 创建商品信息
    if description is None:
        description = f"{title} - 测试商品描述"
    
    product = ProductInfo(
        title=title,
        description=description,
        price=price,
        images=images
    )
    
    logger.info(f"\n📦 商品信息:")
    logger.info(f"  标题: {product.title}")
    logger.info(f"  价格: ¥{product.price}")
    logger.info(f"  图片: {len(product.images)} 张")
    logger.info(f"  描述: {product.description[:50]}...")
    
    # 检查图片文件
    logger.info(f"\n🖼️  检查图片文件:")
    for img_path in product.images:
        if Path(img_path).exists():
            logger.info(f"  ✅ {img_path}")
        else:
            logger.error(f"  ❌ {img_path} (文件不存在)")
            return False
    
    # 创建发布器
    logger.info(f"\n🌐 初始化浏览器...")
    publisher = XianyuProductPublisher(
        cookie_id=cookie_id,
        cookies_str=cookies_str,
        headless=headless
    )
    
    try:
        # 初始化浏览器
        await publisher.init_browser()
        logger.info("  ✅ 浏览器初始化成功")
        
        # Cookie 登录
        logger.info(f"\n🔐 使用 Cookie 登录...")
        login_success = await publisher.login_with_cookie()
        
        if not login_success:
            logger.error("  ❌ Cookie 登录失败")
            logger.error("  请检查 Cookie 是否有效")
            return False
        
        logger.info("  ✅ Cookie 登录成功")
        
        # 发布商品
        logger.info(f"\n📤 开始发布商品...")
        publish_success = await publisher.publish_product(product)
        
        if publish_success:
            logger.success("\n" + "=" * 60)
            logger.success("✅ 商品发布成功!")
            logger.success("=" * 60)
            return True
        else:
            logger.error("\n" + "=" * 60)
            logger.error("❌ 商品发布失败")
            logger.error("=" * 60)
            return False
    
    except Exception as e:
        logger.error(f"\n❌ 测试过程中出错: {e}")
        return False
    
    finally:
        await publisher.close()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="闲鱼商品发布快速测试",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本用法
  python quick_test.py --cookie-id test_001 --title "测试商品" --price 99.00 --images img1.jpg img2.jpg
  
  # 使用环境变量中的 Cookie
  export XIANYU_COOKIE="your_cookie_here"
  python quick_test.py --cookie-id test_001 --title "测试商品" --price 99.00 --images img1.jpg
  
  # 非无头模式（可以看到浏览器操作）
  python quick_test.py --cookie-id test_001 --title "测试商品" --price 99.00 --images img1.jpg --no-headless
        """
    )
    
    parser.add_argument(
        "--cookie-id",
        required=True,
        help="账号ID"
    )
    
    parser.add_argument(
        "--cookie",
        default=None,
        help="Cookie 字符串（如果不提供，将从环境变量 XIANYU_COOKIE 读取）"
    )
    
    parser.add_argument(
        "--title",
        required=True,
        help="商品标题"
    )
    
    parser.add_argument(
        "--price",
        type=float,
        required=True,
        help="商品价格"
    )
    
    parser.add_argument(
        "--images",
        nargs="+",
        required=True,
        help="图片路径列表（空格分隔）"
    )
    
    parser.add_argument(
        "--description",
        default=None,
        help="商品描述（可选）"
    )
    
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="非无头模式（显示浏览器窗口）"
    )
    
    args = parser.parse_args()
    
    # 获取 Cookie
    cookies_str = args.cookie
    if cookies_str is None:
        import os
        cookies_str = os.getenv("XIANYU_COOKIE")
        if cookies_str is None:
            logger.error("❌ 未提供 Cookie，请使用 --cookie 参数或设置 XIANYU_COOKIE 环境变量")
            sys.exit(1)
    
    # 运行测试
    success = asyncio.run(quick_test(
        cookie_id=args.cookie_id,
        cookies_str=cookies_str,
        title=args.title,
        price=args.price,
        images=args.images,
        description=args.description,
        headless=not args.no_headless
    ))
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
