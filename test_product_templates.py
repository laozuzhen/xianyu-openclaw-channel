#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
商品模板功能测试脚本
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(__file__))

from db_manager import DBManager

def test_product_templates():
    """测试商品模板功能"""
    print("=" * 50)
    print("测试商品模板功能")
    print("=" * 50)
    
    # 创建测试数据库
    db = DBManager(db_path='test_templates.db')
    
    # 测试用户ID（假设admin用户ID为1）
    test_user_id = 1
    
    print("\n1. 测试创建商品模板...")
    template_id = db.create_product_template(
        user_id=test_user_id,
        name="测试模板",
        category="数码产品/手机/苹果",
        location="北京市/朝阳区",
        description_template="全新{title}，原装正品，支持验货。"
    )
    print(f"   ✓ 创建成功，模板ID: {template_id}")
    
    print("\n2. 测试获取商品模板列表...")
    templates = db.get_product_templates(test_user_id)
    print(f"   ✓ 获取成功，共 {len(templates)} 个模板")
    for t in templates:
        print(f"     - {t['name']}: {t['category']}")
    
    print("\n3. 测试获取单个模板...")
    template = db.get_product_template_by_id(template_id, test_user_id)
    if template:
        print(f"   ✓ 获取成功: {template['name']}")
    else:
        print("   ✗ 获取失败")
    
    print("\n4. 测试更新模板...")
    success = db.update_product_template(
        template_id=template_id,
        user_id=test_user_id,
        name="更新后的模板",
        location="上海市/浦东新区"
    )
    print(f"   {'✓' if success else '✗'} 更新{'成功' if success else '失败'}")
    
    print("\n5. 测试记录发布历史...")
    history_id = db.add_publish_history(
        user_id=test_user_id,
        cookie_id="test_cookie",
        title="测试商品",
        price=99.99,
        status="success"
    )
    print(f"   ✓ 记录成功，历史ID: {history_id}")
    
    # 再添加一条失败记录
    db.add_publish_history(
        user_id=test_user_id,
        cookie_id="test_cookie",
        title="失败商品",
        price=199.99,
        status="failed",
        error_message="网络错误"
    )
    
    print("\n6. 测试获取发布历史...")
    history = db.get_publish_history(test_user_id, limit=10)
    print(f"   ✓ 获取成功，共 {len(history)} 条记录")
    for h in history:
        print(f"     - {h['title']}: {h['status']} ({h['published_at']})")
    
    print("\n7. 测试获取发布统计...")
    stats = db.get_publish_statistics(test_user_id)
    print(f"   ✓ 统计信息:")
    print(f"     - 总数: {stats['total']}")
    print(f"     - 成功: {stats['success']}")
    print(f"     - 失败: {stats['failed']}")
    print(f"     - 成功率: {stats['success_rate']}%")
    
    print("\n8. 测试删除模板...")
    success = db.delete_product_template(template_id, test_user_id)
    print(f"   {'✓' if success else '✗'} 删除{'成功' if success else '失败'}")
    
    # 清理测试数据库
    db.close()
    if os.path.exists('test_templates.db'):
        os.remove('test_templates.db')
        print("\n✓ 测试数据库已清理")
    
    print("\n" + "=" * 50)
    print("所有测试完成!")
    print("=" * 50)

if __name__ == "__main__":
    test_product_templates()
