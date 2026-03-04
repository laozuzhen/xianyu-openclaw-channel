"""
测试商品发布器 - 打开浏览器查看实际页面元素
"""
import asyncio
import sys
from product_publisher import XianyuProductPublisher, ProductInfo
from db_manager import DBManager

async def test_publisher_ui():
    """测试发布器 UI"""
    
    # 初始化数据库
    db = DBManager()
    
    # 获取账号 Cookie
    cookie_data = db.get_cookie_by_id("2207836320265")
    if not cookie_data:
        print("❌ 未找到账号 Cookie")
        return
    
    print(f"✅ 找到账号: {cookie_data['id']}")
    
    # 创建发布器（非 headless 模式）
    publisher = XianyuProductPublisher(
        cookie_id=cookie_data['id'],
        cookies_str=cookie_data['cookies_str'],
        headless=False  # 显示浏览器
    )
    
    try:
        # 初始化浏览器
        print("🚀 启动浏览器...")
        await publisher.init_browser()
        
        # 登录
        print("🔐 登录中...")
        login_success = await publisher.login_with_cookie()
        if not login_success:
            print("❌ 登录失败")
            return
        
        print("✅ 登录成功")
        
        # 导航到发布页面
        print("📄 打开发布页面...")
        await publisher.page.goto(publisher.PUBLISH_URL)
        await asyncio.sleep(3)
        
        print("\n" + "="*60)
        print("🔍 浏览器已打开，请手动查看页面元素")
        print("="*60)
        print("\n请在浏览器中:")
        print("1. 右键点击元素 -> 检查")
        print("2. 查看元素的选择器、属性、占位符等")
        print("3. 特别关注:")
        print("   - 描述输入框的选择器")
        print("   - 价格输入框的选择器")
        print("   - 原价输入框的选择器")
        print("   - 图片上传按钮的选择器")
        print("\n按 Ctrl+C 退出...")
        
        # 保持浏览器打开
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 退出测试")
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 关闭浏览器
        await publisher.close()

if __name__ == "__main__":
    asyncio.run(test_publisher_ui())
