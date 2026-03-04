"""
闲鱼商品发布 API 测试脚本

测试所有商品发布相关的 API 端点
"""

import requests
import json
import os
from pathlib import Path
from typing import Dict, Any


# API 配置
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
API_TOKEN = os.getenv("API_TOKEN", "your_api_token_here")


class XianyuAPITester:
    """闲鱼 API 测试器"""
    
    def __init__(self, base_url: str = API_BASE_URL, token: str = API_TOKEN):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
    
    def test_health(self) -> bool:
        """测试服务健康状态"""
        print("\n" + "=" * 60)
        print("🏥 测试服务健康状态")
        print("=" * 60)
        
        try:
            response = self.session.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                print("✅ 服务正常运行")
                print(f"响应: {response.json()}")
                return True
            else:
                print(f"❌ 服务异常: {response.status_code}")
                return False
        
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            return False

    def test_auth(self) -> bool:
        """测试认证"""
        print("\n" + "=" * 60)
        print("🔐 测试认证")
        print("=" * 60)
        
        try:
            # 测试无 token 访问
            response = requests.get(f"{self.base_url}/api/products/templates")
            
            if response.status_code == 401:
                print("✅ 未认证请求被正确拒绝")
            else:
                print(f"⚠️  未认证请求返回: {response.status_code}")
            
            # 测试有 token 访问
            response = self.session.get(f"{self.base_url}/api/products/templates")
            
            if response.status_code == 200:
                print("✅ 认证成功")
                return True
            else:
                print(f"❌ 认证失败: {response.status_code}")
                return False
        
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_get_templates(self) -> bool:
        """测试获取商品模板"""
        print("\n" + "=" * 60)
        print("📋 测试获取商品模板")
        print("=" * 60)
        
        try:
            response = self.session.get(f"{self.base_url}/api/products/templates")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 获取成功")
                print(f"模板数量: {len(data.get('templates', []))}")
                print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
                return True
            else:
                print(f"❌ 获取失败: {response.status_code}")
                print(f"响应: {response.text}")
                return False
        
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_publish_single_product(self, cookie_id: str = "test_001") -> bool:
        """测试发布单个商品"""
        print("\n" + "=" * 60)
        print("📤 测试发布单个商品")
        print("=" * 60)
        
        # 准备测试数据
        product_data = {
            "cookie_id": cookie_id,
            "title": "测试商品 - API Test",
            "description": "这是通过 API 测试发布的商品",
            "price": 99.00,
            "images": [
                str(Path("examples/images/product_1.jpg").absolute())
            ],
            "category": "数码产品/手机/苹果",
            "location": "北京市/朝阳区",
            "original_price": 199.00,
            "stock": 1
        }
        
        print(f"请求数据: {json.dumps(product_data, indent=2, ensure_ascii=False)}")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/products/publish",
                json=product_data
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 发布成功")
                print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
                return True
            else:
                print(f"❌ 发布失败: {response.status_code}")
                print(f"响应: {response.text}")
                return False
        
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False

    def test_batch_publish(self, cookie_id: str = "test_001") -> bool:
        """测试批量发布商品"""
        print("\n" + "=" * 60)
        print("📦 测试批量发布商品")
        print("=" * 60)
        
        # 准备测试数据
        batch_data = {
            "cookie_id": cookie_id,
            "products": [
                {
                    "title": f"批量测试商品 {i+1}",
                    "description": f"这是批量测试商品 {i+1} 的描述",
                    "price": 99.00 + i * 100,
                    "images": [str(Path(f"examples/images/product_{i+1}.jpg").absolute())],
                    "category": "数码产品/手机/苹果",
                    "location": "北京市/朝阳区"
                }
                for i in range(3)
            ]
        }
        
        print(f"请求数据: 批量发布 {len(batch_data['products'])} 个商品")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/products/batch-publish",
                json=batch_data
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 批量发布完成")
                print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
                return True
            else:
                print(f"❌ 批量发布失败: {response.status_code}")
                print(f"响应: {response.text}")
                return False
        
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_invalid_data(self) -> bool:
        """测试无效数据处理"""
        print("\n" + "=" * 60)
        print("⚠️  测试无效数据处理")
        print("=" * 60)
        
        # 测试缺少必填字段
        invalid_data = {
            "cookie_id": "test_001",
            # 缺少 title
            "description": "测试描述",
            "price": 99.00,
            "images": []
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/products/publish",
                json=invalid_data
            )
            
            if response.status_code == 422:  # Validation Error
                print("✅ 无效数据被正确拒绝")
                return True
            else:
                print(f"⚠️  返回状态码: {response.status_code}")
                return False
        
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False
    
    def run_all_tests(self, cookie_id: str = "test_001"):
        """运行所有测试"""
        print("\n" + "🚀" * 30)
        print("开始运行 API 测试套件")
        print("🚀" * 30)
        
        results = {
            "服务健康检查": self.test_health(),
            "认证测试": self.test_auth(),
            "获取模板": self.test_get_templates(),
            "发布单个商品": self.test_publish_single_product(cookie_id),
            "批量发布商品": self.test_batch_publish(cookie_id),
            "无效数据处理": self.test_invalid_data(),
        }
        
        # 汇总结果
        print("\n" + "=" * 60)
        print("📊 测试结果汇总")
        print("=" * 60)
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ 通过" if result else "❌ 失败"
            print(f"{test_name}: {status}")
        
        print("\n" + "-" * 60)
        print(f"总计: {passed}/{total} 通过")
        print("=" * 60)
        
        return passed == total


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="闲鱼商品发布 API 测试")
    parser.add_argument(
        "--base-url",
        default=API_BASE_URL,
        help="API 基础 URL"
    )
    parser.add_argument(
        "--token",
        default=API_TOKEN,
        help="API Token"
    )
    parser.add_argument(
        "--cookie-id",
        default="test_001",
        help="测试用的 Cookie ID"
    )
    
    args = parser.parse_args()
    
    # 创建测试器
    tester = XianyuAPITester(
        base_url=args.base_url,
        token=args.token
    )
    
    # 运行所有测试
    success = tester.run_all_tests(cookie_id=args.cookie_id)
    
    import sys
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
