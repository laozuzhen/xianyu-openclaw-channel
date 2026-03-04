"""
闲鱼商品发布器单元测试
"""

import pytest
import asyncio
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import sys

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from product_publisher import (
    XianyuProductPublisher,
    ProductInfo,
    PublisherConfig
)


class TestPublisherConfig:
    """配置管理类测试"""
    
    def test_load_default_config(self):
        """测试加载默认配置"""
        config = PublisherConfig("non_existent_file.yml")
        
        assert config.get('delays', 'operation_min') is not None
        assert config.get('retry', 'max_attempts') is not None
        assert config.get('screenshot', 'enabled') is not None
    
    def test_get_nested_config(self):
        """测试获取嵌套配置"""
        config = PublisherConfig("non_existent_file.yml")
        
        # 测试多级键
        value = config.get('delays', 'operation_min', default=0.5)
        assert isinstance(value, (int, float))
        
        # 测试不存在的键
        value = config.get('non_existent', 'key', default='default_value')
        assert value == 'default_value'
    
    def test_config_reload(self):
        """测试配置重新加载"""
        config = PublisherConfig("non_existent_file.yml")
        
        # 调用 reload 不应该抛出异常
        config.reload_if_changed()
        
        assert config.config is not None


class TestCookieParsing:
    """Cookie 解析测试"""
    
    @pytest.mark.asyncio
    async def test_parse_cookies_basic(self):
        """测试基本 Cookie 解析"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="key1=value1; key2=value2; key3=value3"
        )
        
        cookies = publisher._parse_cookies(publisher.cookies_str)
        
        assert len(cookies) == 3
        assert cookies[0]['name'] == 'key1'
        assert cookies[0]['value'] == 'value1'
        assert cookies[0]['domain'] == '.taobao.com'
    
    @pytest.mark.asyncio
    async def test_parse_cookies_with_spaces(self):
        """测试带空格的 Cookie 解析"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="  key1 = value1 ;  key2 = value2  "
        )
        
        cookies = publisher._parse_cookies(publisher.cookies_str)
        
        assert len(cookies) == 2
        assert cookies[0]['name'] == 'key1'
        assert cookies[0]['value'] == 'value1'
    
    @pytest.mark.asyncio
    async def test_parse_cookies_empty(self):
        """测试空 Cookie 字符串"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str=""
        )
        
        cookies = publisher._parse_cookies(publisher.cookies_str)
        
        assert len(cookies) == 0
    
    @pytest.mark.asyncio
    async def test_parse_cookies_with_equals_in_value(self):
        """测试值中包含等号的 Cookie"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="key1=value=with=equals; key2=normal_value"
        )
        
        cookies = publisher._parse_cookies(publisher.cookies_str)
        
        assert len(cookies) == 2
        assert cookies[0]['name'] == 'key1'
        assert cookies[0]['value'] == 'value=with=equals'


class TestSelectorFallback:
    """选择器降级测试"""
    
    @pytest.mark.asyncio
    async def test_find_element_with_primary_selector(self):
        """测试主选择器查找元素"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        # Mock page
        mock_page = AsyncMock()
        mock_element = Mock()
        mock_page.wait_for_selector = AsyncMock(return_value=mock_element)
        publisher.page = mock_page
        
        # Mock config
        publisher.config.config['selectors'] = {
            'test_selector': {
                'primary': '.primary-selector',
                'fallback': ['.fallback-1', '.fallback-2']
            }
        }
        
        element = await publisher._find_element_with_fallback('test_selector')
        
        assert element == mock_element
        mock_page.wait_for_selector.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_find_element_with_fallback_selector(self):
        """测试备选选择器查找元素"""
        from playwright.async_api import TimeoutError as PlaywrightTimeoutError
        
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        # Mock page
        mock_page = AsyncMock()
        mock_element = Mock()
        
        # 主选择器超时，备选选择器成功
        async def mock_wait_for_selector(selector, timeout=None):
            if selector == '.primary-selector':
                raise PlaywrightTimeoutError("Timeout")
            elif selector == '.fallback-1':
                return mock_element
            return None
        
        mock_page.wait_for_selector = mock_wait_for_selector
        publisher.page = mock_page
        
        # Mock config
        publisher.config.config['selectors'] = {
            'test_selector': {
                'primary': '.primary-selector',
                'fallback': ['.fallback-1', '.fallback-2']
            }
        }
        
        element = await publisher._find_element_with_fallback('test_selector')
        
        assert element == mock_element
    
    @pytest.mark.asyncio
    async def test_find_element_all_selectors_fail(self):
        """测试所有选择器都失败"""
        from playwright.async_api import TimeoutError as PlaywrightTimeoutError
        
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        # Mock page
        mock_page = AsyncMock()
        mock_page.wait_for_selector = AsyncMock(side_effect=PlaywrightTimeoutError("Timeout"))
        publisher.page = mock_page
        
        # Mock config
        publisher.config.config['selectors'] = {
            'test_selector': {
                'primary': '.primary-selector',
                'fallback': ['.fallback-1', '.fallback-2']
            }
        }
        
        element = await publisher._find_element_with_fallback('test_selector')
        
        assert element is None


class TestProgressCallback:
    """进度回调测试"""
    
    @pytest.mark.asyncio
    async def test_set_progress_callback(self):
        """测试设置进度回调"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        callback_called = []
        
        def test_callback(event, data):
            callback_called.append((event, data))
        
        publisher.set_progress_callback(test_callback)
        publisher._emit_progress('test_event', {'key': 'value'})
        
        assert len(callback_called) == 1
        assert callback_called[0][0] == 'test_event'
        assert callback_called[0][1]['key'] == 'value'
    
    @pytest.mark.asyncio
    async def test_progress_callback_exception_handling(self):
        """测试进度回调异常处理"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        def failing_callback(event, data):
            raise Exception("Callback failed")
        
        publisher.set_progress_callback(failing_callback)
        
        # 不应该抛出异常
        publisher._emit_progress('test_event', {'key': 'value'})


class TestRetryMechanism:
    """重试机制测试"""
    
    @pytest.mark.asyncio
    async def test_retry_success_on_first_attempt(self):
        """测试第一次尝试成功"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        async def test_func():
            return "success"
        
        result = await publisher._retry_with_backoff(test_func, max_attempts=3)
        
        assert result == "success"
    
    @pytest.mark.asyncio
    async def test_retry_success_on_second_attempt(self):
        """测试第二次尝试成功"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        attempt_count = [0]
        
        async def test_func():
            attempt_count[0] += 1
            if attempt_count[0] < 2:
                raise Exception("First attempt failed")
            return "success"
        
        result = await publisher._retry_with_backoff(test_func, max_attempts=3)
        
        assert result == "success"
        assert attempt_count[0] == 2
    
    @pytest.mark.asyncio
    async def test_retry_all_attempts_fail(self):
        """测试所有尝试都失败"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        async def test_func():
            raise Exception("Always fails")
        
        with pytest.raises(Exception, match="Always fails"):
            await publisher._retry_with_backoff(test_func, max_attempts=3)


class TestScreenshot:
    """截图功能测试"""
    
    @pytest.mark.asyncio
    async def test_take_screenshot_disabled(self):
        """测试截图功能禁用"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        # 禁用截图
        publisher.config.config['screenshot']['enabled'] = False
        
        result = await publisher.take_screenshot()
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_take_screenshot_with_product_title(self):
        """测试带商品标题的截图"""
        publisher = XianyuProductPublisher(
            cookie_id="test_user",
            cookies_str="test=cookie"
        )
        
        # Mock page
        mock_page = AsyncMock()
        mock_page.screenshot = AsyncMock()
        publisher.page = mock_page
        
        # 启用截图
        publisher.config.config['screenshot']['enabled'] = True
        
        result = await publisher.take_screenshot(product_title="测试商品")
        
        assert result is not None
        assert "测试商品" in result or "test" in result.lower()
        mock_page.screenshot.assert_called_once()


class TestProductInfo:
    """商品信息数据类测试"""
    
    def test_product_info_basic(self):
        """测试基本商品信息"""
        product = ProductInfo(
            title="测试商品",
            description="这是一个测试商品",
            price=99.99,
            images=["image1.jpg", "image2.jpg"]
        )
        
        assert product.title == "测试商品"
        assert product.description == "这是一个测试商品"
        assert product.price == 99.99
        assert len(product.images) == 2
    
    def test_product_info_with_optional_fields(self):
        """测试带可选字段的商品信息"""
        product = ProductInfo(
            title="测试商品",
            description="这是一个测试商品",
            price=99.99,
            images=["image1.jpg"],
            category="数码产品/手机/苹果",
            location="北京市/朝阳区",
            original_price=199.99,
            stock=10
        )
        
        assert product.category == "数码产品/手机/苹果"
        assert product.location == "北京市/朝阳区"
        assert product.original_price == 199.99
        assert product.stock == 10


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
