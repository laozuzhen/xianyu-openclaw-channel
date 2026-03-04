#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查用户和账号的 user_id 匹配情况"""

from db_manager import db_manager

print("=== 游客用户信息 ===")
guest = db_manager.get_user_by_username('guest')
if guest:
    print(f"游客 user_id: {guest['id']}")
    print(f"游客用户名: {guest['username']}")
else:
    print("游客用户不存在")

print("\n=== 所有账号的 user_id ===")
cookies = db_manager.get_all_cookies()
for c in cookies:
    user_id = c.get('user_id', 'NULL')
    nickname = c.get('nickname', '无昵称')
    print(f"账号 {c['id']}: user_id={user_id}, 昵称={nickname}")

print("\n=== 问题分析 ===")
if guest:
    guest_id = guest['id']
    mismatched = [c for c in cookies if c.get('user_id') != guest_id]
    if mismatched:
        print(f"发现 {len(mismatched)} 个账号的 user_id 与游客不匹配:")
        for c in mismatched:
            print(f"  - 账号 {c['id']}: user_id={c.get('user_id', 'NULL')} (应该是 {guest_id})")
    else:
        print("所有账号的 user_id 都匹配游客")
