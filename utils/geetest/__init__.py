"""
极验滑动验证码服务模块

功能：
1. 验证码初始化（register）
2. 二次验证（validate）
3. 支持正常模式和宕机降级模式
"""
from .geetest_lib import GeetestLib
from .geetest_config import GeetestConfig

__all__ = ["GeetestLib", "GeetestConfig"]
