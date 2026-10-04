"""密码哈希 / JWT / API Key 加密。

API Key 落库前必须加密：数据库泄露不等于 Key 泄露。
加密密钥由 SECRET_KEY 派生，所以 SECRET_KEY 一旦更换，库里已存的 Key 就解不开了（会表现为「Key 丢失，需重新填写」）。
"""
import base64
import hashlib
import time

import bcrypt
import jwt
from cryptography.fernet import Fernet

from .config import SECRET_KEY, TOKEN_DAYS


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("ascii"))
    except Exception:
        return False


_FERNET = Fernet(base64.urlsafe_b64encode(hashlib.sha256(("wyzb::key::" + SECRET_KEY).encode("utf-8")).digest()))


def encrypt_secret(plain: str) -> str:
    if not plain:
        return ""
    return _FERNET.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    if not token:
        return ""
    try:
        return _FERNET.decrypt(token.encode("ascii")).decode("utf-8")
    except Exception:
        return ""


def make_token(user_id: int, username: str) -> str:
    now = int(time.time())
    payload = {"sub": str(user_id), "u": username, "iat": now, "exp": now + TOKEN_DAYS * 86400}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def read_token(token: str):
    """返回 (user_id, username)，无效返回 None。"""
    if not token:
        return None
    try:
        d = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return int(d.get("sub")), d.get("u") or ""
    except Exception:
        return None


def mask_key(k: str) -> str:
    """只回传前 6 位，够用户辨认又不泄露。"""
    if not k:
        return ""
    return k[:6] + "***" + (k[-2:] if len(k) > 10 else "")
