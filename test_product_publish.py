"""
闲鱼商品发布功能测试套件

使用 pytest 框架测试商品发布功能
"""

import pytest
import asyncio
import os
from pathlib import Path
from product_publisher import XianyuProductPublisher, ProductInfo


# 测试配置
TEST_COOKIE_ID = "test_account_001"
TEST_COOKIES_STR = os.getenv("XIANYU_TEST_COOKIE", "your_test_cookie_here")


@pytest.fixture
def sample_product():
    """示例商品数据"""
    return ProductInfo(
        title="测试商品 - iPhone 15 Pro Max",
        description="这是一个测试商品，全新未拆封，原装正品。",
        price=8999.00,
        images=[
            str(Path("examples/images/phone_1.jpg").absolute()),
            str(Path("examples/images/phone_2.jpg").absolute()),
        ],
        category="数码产品/手机/苹果",
        location="北京市/朝阳区",
        original_price=9999.00,
        stock=1
    )


@pytest.fixture
def sample_products():
    """批量示例商品数据"""
    return [
        ProductInfo(
            title=f"测试商品 {i+1}",
            description=f"这是测试商品 {i+1} 的描述",
            price=99.00 + i * 100,
            images=[str(Path(f"examples/images/product_{i+1}.jpg").absolute())],
            category="数码产品/手机/苹果",
            location="北京市/朝阳区"
        )
        for i in range(3)
    ]


@pytest.fixture
async def publisher():
    """创建发布器实例"""
    pub = XianyuProductPublisher(
        cookie_id=TEST_COOKIE_ID,
        cookies_str=TEST_COOKIES_STR,
        headless=True
    )
    await pub.init_browser()
    yield pub
    await pub.close()


class TestProductPublisher:
    """商品发布器测试类"""
    
    @pytest.mark.asyncio
    async def test_browser_init(self):
        """测试浏览器初始化"""
        publisher = XianyuProductPublisher(
            cookie_id=TEST_COOKIE_ID,
            cookies_str=TEST_COOKIES_STR,
            headless=True
        )
        
        await publisher.init_browser()
        
        assert publisher.browser is not None
        assert publisher.context is not None
        assert publisher.page is not None
        
        await publisher.close()
    
    @pytest.mark.asyncio
    async def test_cookie_login(self, publisher):
        """测试 Cookie 登录"""
        # 注意：需要有效的 Cookie 才能通过此测试
        if TEST_COOKIES_STR == "your_test_cookie_here":
            pytest.skip("需要配置有效的测试 Cookie")
        
        success = await publisher.login_with_cookie()
        assert success is True
    
    @pytest.mark.asyncio
    async def test_single_product_publish(self, publisher, sample_product):
        """测试单个商品发布"""
        # 注意：需要有效的 Cookie 和图片文件
        if TEST_COOKIES_STR == "your_test_cookie_here":
            pytest.skip("需要配置有效的测试 Cookie")
        
        # 检查图片文件是否存在
        for img_path in sample_product.images:
            if not Path(img_path).exists():
                pytest.skip(f"图片文件不存在: {img_path}")
        
        # 登录
        login_success = await publisher.login_with_cookie()
        assert login_success is True
        
        # 发布商品
        publish_success = await publisher.publish_product(sample_product)
        assert publish_success is True
    
    @pytest.mark.asyncio
    async def test_batch_publish(self, publisher, sample_products):
        """测试批量商品发布"""
        if TEST_COOKIES_STR == "your_test_cookie_here":
            pytest.skip("需要配置有效的测试 Cookie")
        
        # 检查图片文件
        for product in sample_products:
            for img_path in product.images:
                if not Path(img_path).exists():
                    pytest.skip(f"图片文件不存在: {img_path}")
        
        # 登录
        login_success = await publisher.login_with_cookie()
        assert login_success is True
        
        # 批量发布
        results = await publisher.batch_publish(sample_products)
        
        assert results['total'] == len(sample_products)
        assert results['success'] > 0
    
    @pytest.mark.asyncio
    async def test_invalid_cookie(self):
        """测试无效 Cookie 处理"""
        publisher = XianyuProductPublisher(
            cookie_id="test_invalid",
            cookies_str="invalid_cookie_string",
            headless=True
        )
        
        await publisher.init_browser()
        
        # 应该登录失败
        success = await publisher.login_with_cookie()
        assert success is False
        
        await publisher.close()
    
    @pytest.mark.asyncio
    async def test_missing_images(self, publisher):
        """测试缺失图片处理"""
        product = ProductInfo(
            title="测试商品",
            description="测试描述",
            price=99.00,
            images=["/path/to/nonexistent/image.jpg"]
        )
        
        if TEST_COOKIES_STR == "your_test_cookie_here":
            pytest.skip("需要配置有效的测试 Cookie")
        
        # 登录
        await publisher.login_with_cookie()
        
        # 尝试发布（应该失败）
        success = await publisher.publish_product(product)
        assert success is False


class TestProductInfo:
    """ProductInfo 数据类测试"""
    
    def test_product_info_creation(self):
        """测试商品信息创建"""
        product = ProductInfo(
            title="测试商品",
            description="测试描述",
            price=99.00,
            images=["img1.jpg", "img2.jpg"]
        )
        
        assert product.title == "测试商品"
        assert product.price == 99.00
        assert len(product.images) == 2
        assert product.stock == 1  # 默认值
    
    def test_product_info_optional_fields(self):
        """测试可选字段"""
        product = ProductInfo(
            title="测试商品",
            description="测试描述",
            price=99.00,
            images=["img1.jpg"],
            category="数码产品/手机",
            location="北京市/朝阳区",
            original_price=199.00,
            stock=5
        )
        
        assert product.category == "数码产品/手机"
        assert product.location == "北京市/朝阳区"
        assert product.original_price == 199.00
        assert product.stock == 5


class TestErrorHandling:
    """错误处理测试"""
    
    @pytest.mark.asyncio
    async def test_empty_title(self, publisher):
        """测试空标题处理"""
        product = ProductInfo(
            title="",
            description="测试描述",
            price=99.00,
            images=["img1.jpg"]
        )
        
        if TEST_COOKIES_STR == "your_test_cookie_here":
            pytest.skip("需要配置有效的测试 Cookie")
        
        await publisher.login_with_cookie()
        success = await publisher.publish_product(product)
        assert success is False
    
    @pytest.mark.asyncio
    async def test_negative_price(self, publisher):
        """测试负价格处理"""
        product = ProductInfo(
            title="测试商品",
            description="测试描述",
            price=-99.00,
            images=["img1.jpg"]
        )
        
        if TEST_COOKIES_STR == "your_test_cookie_here":
            pytest.skip("需要配置有效的测试 Cookie")
        
        await publisher.login_with_cookie()
        success = await publisher.publish_product(product)
        assert success is False


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v", "-s"])
