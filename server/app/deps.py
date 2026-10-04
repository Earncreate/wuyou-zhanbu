from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from . import models
from .db import get_db
from .security import read_token


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> models.User:
    token = ""
    if authorization:
        parts = authorization.split()
        token = parts[-1] if parts else ""
    info = read_token(token)
    if not info:
        raise HTTPException(status_code=401, detail="未登录或登录已过期")
    uid = info[0]
    u = db.get(models.User, uid)
    if not u or not u.is_active:
        raise HTTPException(status_code=401, detail="账号不可用")
    return u
