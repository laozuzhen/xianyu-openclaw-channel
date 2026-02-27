"""
极验验证码SDK核心库

功能：
1. 验证码初始化（register）- 获取challenge等参数
2. 二次验证（validate）- 验证用户滑动结果
3. 支持MD5/SHA256/HMAC-SHA256加密
4. 支持宕机降级模式
"""
import hashlib
import hmac
import json
import uuid
from enum import Enum
from typing import Dict, Optional
from dataclasses import dataclass

import httpx
from loguru import logger

from .geetest_config import GeetestConfig


class DigestMod(Enum):
    """加密算法枚举"""
    MD5 = "md5"
    SHA256 = "sha256"
    HMAC_SHA256 = "hmac-sha256"


@dataclass
class GeetestResult:
    """极验返回结果封装"""
    status: int = 0  # 1成功，0失败
    data: str = ""   # 返回数据（JSON字符串）
    msg: str = ""    # 备注信息
    
    def to_dict(self) -> dict:
        """转换为字典"""
        if self.data:
            try:
                return json.loads(self.data)
            except json.JSONDecodeError:
                return {}
        return {}


class GeetestLib:
    """
    极验验证码SDK核心类
    
    使用方法：
    1. 初始化: gt_lib = GeetestLib()
    2. 获取验证码参数: result = await gt_lib.register()
    3. 二次验证: result = await gt_lib.validate(challenge, validate, seccode)
    """
    
    def __init__(
        self,
        captcha_id: Optional[str] = None,
        private_key: Optional[str] = None
    ):
        """
        初始化极验SDK
        
        Args:
            captcha_id: 极验分配的captcha_id，默认从配置读取
            private_key: 极验分配的私钥，默认从配置读取
        """
        self.captcha_id = captcha_id or GeetestConfig.CAPTCHA_ID
        self.private_key = private_key or GeetestConfig.PRIVATE_KEY
        self.result = GeetestResult()
    
    def _md5_encode(self, value: str) -> str:
        """MD5加密"""
        return hashlib.md5(value.encode("utf-8")).hexdigest()
    
    def _sha256_encode(self, value: str) -> str:
        """SHA256加密"""
        return hashlib.sha256(value.encode("utf-8")).hexdigest()
    
    def _hmac_sha256_encode(self, value: str, key: str) -> str:
        """HMAC-SHA256加密"""
        return hmac.new(
            key.encode("utf-8"),
            value.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
    
    def _encrypt_challenge(self, origin_challenge: str, digest_mod: DigestMod) -> str:
        """
        加密challenge
        
        Args:
            origin_challenge: 原始challenge
            digest_mod: 加密算法
        
        Returns:
            加密后的challenge
        """
        if digest_mod == DigestMod.MD5:
            return self._md5_encode(origin_challenge + self.private_key)
        elif digest_mod == DigestMod.SHA256:
            return self._sha256_encode(origin_challenge + self.private_key)
        elif digest_mod == DigestMod.HMAC_SHA256:
            return self._hmac_sha256_encode(origin_challenge, self.private_key)
        else:
            return self._md5_encode(origin_challenge + self.private_key)
    
    async def _request_register(self, params: Dict[str, str]) -> str:
        """
        向极验发送验证初始化请求
        
        Args:
            params: 请求参数
        
        Returns:
            原始challenge字符串
        """
        params.update({
            "gt": self.captcha_id,
            "json_format": "1",
            "sdk": GeetestConfig.VERSION
        })
        
        url = f"{GeetestConfig.API_URL}{GeetestConfig.REGISTER_URL}"
        
        try:
            async with httpx.AsyncClient(timeout=GeetestConfig.TIMEOUT) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                logger.debug(f"极验register响应: {data}")
                return data.get("challenge", "")
        except Exception as e:
            logger.error(f"极验register请求失败: {e}")
            return ""
    
    def _build_register_result(
        self,
        origin_challenge: Optional[str],
        digest_mod: Optional[DigestMod]
    ) -> None:
        """
        构建验证初始化返回数据
        
        Args:
            origin_challenge: 原始challenge
            digest_mod: 加密算法
        """
        # challenge为空或为0表示失败，走宕机模式
        if not origin_challenge or origin_challenge == "0":
            # 本地生成随机challenge
            challenge = uuid.uuid4().hex
            data = {
                "success": 0,
                "gt": self.captcha_id,
                "challenge": challenge,
                "new_captcha": True
            }
            self.result = GeetestResult(
                status=0,
                data=json.dumps(data),
                msg="初始化接口失败，后续流程走宕机模式"
            )
        else:
            # 正常模式，加密challenge
            challenge = self._encrypt_challenge(origin_challenge, digest_mod or DigestMod.MD5)
            data = {
                "success": 1,
                "gt": self.captcha_id,
                "challenge": challenge,
                "new_captcha": True
            }
            self.result = GeetestResult(
                status=1,
                data=json.dumps(data),
                msg=""
            )
    
    async def register(
        self,
        digest_mod: DigestMod = DigestMod.MD5,
        user_id: Optional[str] = None,
        client_type: Optional[str] = None
    ) -> GeetestResult:
        """
        验证码初始化
        
        Args:
            digest_mod: 加密算法，默认MD5
            user_id: 用户标识
            client_type: 客户端类型
        
        Returns:
            GeetestResult对象
        """
        logger.info(f"极验register开始: digest_mod={digest_mod.value}")
        
        params = {
            "digestmod": digest_mod.value,
            "user_id": user_id or GeetestConfig.USER_ID,
            "client_type": client_type or GeetestConfig.CLIENT_TYPE
        }
        
        origin_challenge = await self._request_register(params)
        self._build_register_result(origin_challenge, digest_mod)
        
        logger.info(f"极验register完成: status={self.result.status}")
        return self.result
    
    def local_init(self) -> GeetestResult:
        """
        本地初始化（宕机降级模式）
        
        Returns:
            GeetestResult对象
        """
        logger.info("极验本地初始化（宕机模式）")
        self._build_register_result(None, None)
        return self.result

    
    async def _request_validate(
        self,
        challenge: str,
        validate: str,
        seccode: str,
        params: Dict[str, str]
    ) -> str:
        """
        向极验发送二次验证请求
        
        Args:
            challenge: challenge
            validate: validate
            seccode: seccode
            params: 额外参数
        
        Returns:
            响应的seccode
        """
        params.update({
            "seccode": seccode,
            "json_format": "1",
            "challenge": challenge,
            "sdk": GeetestConfig.VERSION,
            "captchaid": self.captcha_id
        })
        
        url = f"{GeetestConfig.API_URL}{GeetestConfig.VALIDATE_URL}"
        
        try:
            async with httpx.AsyncClient(timeout=GeetestConfig.TIMEOUT) as client:
                response = await client.post(url, data=params)
                response.raise_for_status()
                data = response.json()
                logger.debug(f"极验validate响应: {data}")
                return data.get("seccode", "")
        except Exception as e:
            logger.error(f"极验validate请求失败: {e}")
            return ""
    
    def _check_params(self, challenge: str, validate: str, seccode: str) -> bool:
        """
        校验二次验证参数
        
        Args:
            challenge: challenge
            validate: validate
            seccode: seccode
        
        Returns:
            参数是否有效
        """
        return bool(
            challenge and challenge.strip() and
            validate and validate.strip() and
            seccode and seccode.strip()
        )
    
    async def success_validate(
        self,
        challenge: str,
        validate: str,
        seccode: str,
        user_id: Optional[str] = None,
        client_type: Optional[str] = None
    ) -> GeetestResult:
        """
        正常模式下的二次验证
        
        Args:
            challenge: 验证流水号
            validate: 验证结果
            seccode: 验证结果加密串
            user_id: 用户标识
            client_type: 客户端类型
        
        Returns:
            GeetestResult对象
        """
        logger.info(f"极验二次验证（正常模式）: challenge={challenge[:16]}...")
        
        if not self._check_params(challenge, validate, seccode):
            self.result = GeetestResult(
                status=0,
                data="",
                msg="正常模式，本地校验，参数challenge、validate、seccode不可为空"
            )
            return self.result
        
        params = {
            "user_id": user_id or GeetestConfig.USER_ID,
            "client_type": client_type or GeetestConfig.CLIENT_TYPE
        }
        
        response_seccode = await self._request_validate(challenge, validate, seccode, params)
        
        if not response_seccode:
            self.result = GeetestResult(
                status=0,
                data="",
                msg="请求极验validate接口失败"
            )
        elif response_seccode == "false":
            self.result = GeetestResult(
                status=0,
                data="",
                msg="极验二次验证不通过"
            )
        else:
            self.result = GeetestResult(
                status=1,
                data="",
                msg=""
            )
        
        logger.info(f"极验二次验证完成: status={self.result.status}")
        return self.result
    
    def fail_validate(
        self,
        challenge: str,
        validate: str,
        seccode: str
    ) -> GeetestResult:
        """
        宕机模式下的二次验证（简单参数校验）
        
        Args:
            challenge: 验证流水号
            validate: 验证结果
            seccode: 验证结果加密串
        
        Returns:
            GeetestResult对象
        """
        logger.info(f"极验二次验证（宕机模式）: challenge={challenge[:16] if challenge else 'None'}...")
        
        if not self._check_params(challenge, validate, seccode):
            self.result = GeetestResult(
                status=0,
                data="",
                msg="宕机模式，本地校验，参数challenge、validate、seccode不可为空"
            )
        else:
            self.result = GeetestResult(
                status=1,
                data="",
                msg=""
            )
        
        return self.result
