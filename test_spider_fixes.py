"""
商品搜索爬虫修复验证测试

验证所有修复项是否正确实现：
- C1: 反检测增强配置
- C2: 超时和重试机制
- C3: 代理 IP 支持
- M1: 请求间隔控制
- M2: 细化错误处理
- M3: 数据验证
- M4: OpenClaw 工具注册
"""

import json


def test_c1_anti_detection_config():
    """验证 C1: 反检测增强配置"""
    print("\n【C1】验证反检测增强配置...")
    
    # 检查代码中是否包含新增的参数
    with open("product_spider.py", "r", encoding="utf-8") as f:
        content = f.read()
        
    required_args = [
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process"
    ]
    
    for arg in required_args:
        if arg in content:
            print(f"  ✅ 找到参数: {arg}")
        else:
            print(f"  ❌ 缺少参数: {arg}")
            return False
    
    print("  ✅ C1 修复验证通过")
    return True


def test_c2_retry_mechanism():
    """验证 C2: 超时和重试机制"""
    print("\n【C2】验证超时和重试机制...")
    
    with open("product_spider.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 检查是否导入 tenacity
    if "from tenacity import" not in content:
        print("  ❌ 未导入 tenacity 库")
        return False
    print("  ✅ 已导入 tenacity 库")
    
    # 检查是否有 @retry 装饰器
    if "@retry" not in content:
        print("  ❌ 未找到 @retry 装饰器")
        return False
    print("  ✅ 找到 @retry 装饰器")
    
    # 检查是否有 _goto_with_retry 方法
    if "_goto_with_retry" not in content:
        print("  ❌ 未找到 _goto_with_retry 方法")
        return False
    print("  ✅ 找到 _goto_with_retry 方法")
    
    # 检查 requirements.txt
    with open("requirements.txt", "r", encoding="utf-8") as f:
        req_content = f.read()
    
    if "tenacity" not in req_content:
        print("  ❌ requirements.txt 中未添加 tenacity")
        return False
    print("  ✅ requirements.txt 中已添加 tenacity")
    
    print("  ✅ C2 修复验证通过")
    return True


def test_c3_proxy_support():
    """验证 C3: 代理 IP 支持"""
    print("\n【C3】验证代理 IP 支持...")
    
    with open("product_spider.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 检查 __init__ 是否有 proxy 参数
    if "proxy: Optional[Dict] = None" not in content:
        print("  ❌ __init__ 方法缺少 proxy 参数")
        return False
    print("  ✅ __init__ 方法有 proxy 参数")
    
    # 检查是否有 self.proxy
    if "self.proxy = proxy" not in content:
        print("  ❌ 未保存 proxy 到实例变量")
        return False
    print("  ✅ 已保存 proxy 到实例变量")
    
    # 检查是否在 context 中使用代理
    if "context_options['proxy']" not in content:
        print("  ❌ 未在 context 中配置代理")
        return False
    print("  ✅ 已在 context 中配置代理")
    
    # 检查便捷函数是否支持代理
    if "proxy: Optional[Dict] = None" not in content or "search_xianyu_products" not in content:
        print("  ❌ 便捷函数未支持代理参数")
        return False
    print("  ✅ 便捷函数支持代理参数")
    
    print("  ✅ C3 修复验证通过")
    return True


def test_m1_random_delay():
    """验证 M1: 请求间隔控制"""
    print("\n【M1】验证请求间隔控制...")
    
    with open("product_spider.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 检查是否导入 random
    if "import random" not in content:
        print("  ❌ 未导入 random 模块")
        return False
    print("  ✅ 已导入 random 模块")
    
    # 检查是否使用 random.uniform
    if "random.uniform(2, 5)" not in content:
        print("  ❌ 未使用 random.uniform(2, 5)")
        return False
    print("  ✅ 使用 random.uniform(2, 5) 随机延迟")
    
    print("  ✅ M1 修复验证通过")
    return True


def test_m2_error_handling():
    """验证 M2: 细化错误处理"""
    print("\n【M2】验证细化错误处理...")
    
    with open("product_spider.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 检查是否导入 Playwright 异常
    if "PlaywrightTimeoutError" not in content or "PlaywrightError" not in content:
        print("  ❌ 未导入 Playwright 异常类型")
        return False
    print("  ✅ 已导入 Playwright 异常类型")
    
    # 检查是否有细化的异常捕获
    if "except PlaywrightTimeoutError" not in content:
        print("  ❌ 未捕获 PlaywrightTimeoutError")
        return False
    print("  ✅ 已捕获 PlaywrightTimeoutError")
    
    if "except PlaywrightError" not in content:
        print("  ❌ 未捕获 PlaywrightError")
        return False
    print("  ✅ 已捕获 PlaywrightError")
    
    print("  ✅ M2 修复验证通过")
    return True


def test_m3_data_validation():
    """验证 M3: 数据验证"""
    print("\n【M3】验证数据验证...")
    
    with open("product_spider.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 检查是否有 _validate_product_data 方法
    if "_validate_product_data" not in content:
        print("  ❌ 未找到 _validate_product_data 方法")
        return False
    print("  ✅ 找到 _validate_product_data 方法")
    
    # 检查是否验证必填字段
    if "required_fields" not in content:
        print("  ❌ 未验证必填字段")
        return False
    print("  ✅ 验证必填字段")
    
    # 检查是否验证价格格式
    if "价格格式异常" not in content:
        print("  ❌ 未验证价格格式")
        return False
    print("  ✅ 验证价格格式")
    
    # 检查是否在保存前调用验证
    if "if not self._validate_product_data(item):" not in content:
        print("  ❌ 保存前未调用数据验证")
        return False
    print("  ✅ 保存前调用数据验证")
    
    print("  ✅ M3 修复验证通过")
    return True


def test_m4_openclaw_tool_registration():
    """验证 M4: OpenClaw 工具注册"""
    print("\n【M4】验证 OpenClaw 工具注册...")
    
    with open("openclaw-plugin/openclaw.plugin.json", "r", encoding="utf-8") as f:
        config = json.load(f)
    
    # 检查是否有 tools 字段
    if "tools" not in config:
        print("  ❌ 配置文件缺少 tools 字段")
        return False
    print("  ✅ 配置文件有 tools 字段")
    
    # 检查是否注册了 search_xianyu_products 工具
    tools = config.get("tools", [])
    if not tools:
        print("  ❌ tools 字段为空")
        return False
    
    tool_names = [tool.get("name") for tool in tools]
    if "search_xianyu_products" not in tool_names:
        print("  ❌ 未注册 search_xianyu_products 工具")
        return False
    print("  ✅ 已注册 search_xianyu_products 工具")
    
    # 检查工具配置是否完整
    tool = tools[0]
    if "description" not in tool:
        print("  ❌ 工具缺少 description")
        return False
    print("  ✅ 工具有 description")
    
    if "parameters" not in tool:
        print("  ❌ 工具缺少 parameters")
        return False
    print("  ✅ 工具有 parameters")
    
    params = tool.get("parameters", {}).get("properties", {})
    if "keyword" not in params:
        print("  ❌ 工具参数缺少 keyword")
        return False
    print("  ✅ 工具参数有 keyword")
    
    if "max_pages" not in params:
        print("  ❌ 工具参数缺少 max_pages")
        return False
    print("  ✅ 工具参数有 max_pages")
    
    print("  ✅ M4 修复验证通过")
    return True


def main():
    """运行所有验证测试"""
    print("=" * 60)
    print("商品搜索爬虫修复验证测试")
    print("=" * 60)
    
    results = {
        "C1: 反检测增强配置": test_c1_anti_detection_config(),
        "C2: 超时和重试机制": test_c2_retry_mechanism(),
        "C3: 代理 IP 支持": test_c3_proxy_support(),
        "M1: 请求间隔控制": test_m1_random_delay(),
        "M2: 细化错误处理": test_m2_error_handling(),
        "M3: 数据验证": test_m3_data_validation(),
        "M4: OpenClaw 工具注册": test_m4_openclaw_tool_registration(),
    }
    
    print("\n" + "=" * 60)
    print("验证结果汇总")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"总计: {passed} 通过, {failed} 失败")
    print("=" * 60)
    
    if failed == 0:
        print("\n🎉 所有修复项验证通过！")
        return True
    else:
        print(f"\n⚠️ 有 {failed} 项修复未通过验证")
        return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
