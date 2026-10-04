import re
from typing import Any, Dict, List

from pydantic import BaseModel, field_validator

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,24}$")


class RegisterIn(BaseModel):
    username: str
    password: str
    invite_code: str = ""
    nickname: str = ""

    @field_validator("username")
    @classmethod
    def _u(cls, v):
        v = (v or "").strip()
        if not USERNAME_RE.match(v):
            raise ValueError("用户名需 3-24 位字母、数字或下划线")
        return v

    @field_validator("password")
    @classmethod
    def _p(cls, v):
        v = v or ""
        if len(v) < 6 or len(v) > 64:
            raise ValueError("密码需 6-64 位")
        return v


class LoginIn(BaseModel):
    username: str
    password: str


class KeyIn(BaseModel):
    base: str = ""
    model: str = ""
    key: str = ""


class RecordChange(BaseModel):
    id: str
    updatedAt: int = 0
    deleted: bool = False
    payload: Dict[str, Any] = {}


class SyncIn(BaseModel):
    since: int = 0
    changes: List[RecordChange] = []


class ChatIn(BaseModel):
    messages: List[Dict[str, Any]]
    temperature: float = 0.7
    model: str = ""
    base: str = ""
    key: str = ""      # 不想入库时可直接传，用完即弃
