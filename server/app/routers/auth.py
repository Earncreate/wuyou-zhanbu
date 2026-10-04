import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .. import models
from ..config import INVITE_REQUIRED, LOGIN_MAX_FAIL, LOGIN_WINDOW_SEC
from ..db import get_db
from ..deps import current_user
from ..schemas import LoginIn, RegisterIn
from ..security import hash_password, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class PasswordIn(BaseModel):
    old: str = ""
    new: str = ""


def _now():
    return datetime.now(timezone.utc)


# 极简内存限流（单实例足够；多实例请换 Redis）
_FAILS = defaultdict(deque)


def _guard(key: str):
    now = time.time()
    q = _FAILS[key]
    while q and now - q[0] > LOGIN_WINDOW_SEC:
        q.popleft()
    if len(q) >= LOGIN_MAX_FAIL:
        raise HTTPException(status_code=429, detail="尝试过于频繁，请稍后再试")
    return q


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.username == body.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="该用户名已被注册")

    code = (body.invite_code or "").strip()
    invite = None
    if INVITE_REQUIRED:
        if not code:
            raise HTTPException(status_code=400, detail="注册需要邀请码")
        invite = db.query(models.InviteCode).filter(models.InviteCode.code == code).first()
        if not invite:
            raise HTTPException(status_code=400, detail="邀请码无效")
        if invite.used_by is not None:
            raise HTTPException(status_code=400, detail="该邀请码已被使用")

    user = models.User(
        username=body.username,
        pw_hash=hash_password(body.password),
        nickname=(body.nickname or "").strip()[:64],
    )
    db.add(user)
    try:
        db.flush()
        if invite is not None:
            invite.used_by = user.id
            invite.used_at = _now()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="该用户名已被注册")

    return {"ok": True, "token": make_token(user.id, user.username), "username": user.username}


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "?"
    q = _guard(f"{ip}|{body.username}")
    u = db.query(models.User).filter(models.User.username == (body.username or "").strip()).first()
    if not u or not verify_password(body.password or "", u.pw_hash):
        q.append(time.time())
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not u.is_active:
        raise HTTPException(status_code=403, detail="账号已停用")
    u.last_login_at = _now()
    db.commit()
    _FAILS.pop(f"{ip}|{body.username}", None)
    return {"ok": True, "token": make_token(u.id, u.username), "username": u.username}


@router.get("/me")
def me(u: models.User = Depends(current_user)):
    return {"ok": True, "username": u.username, "nickname": u.nickname or "", "id": u.id}


@router.post("/password")
def change_password(body: PasswordIn, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old or "", u.pw_hash):
        raise HTTPException(status_code=400, detail="原密码不正确")
    if len(body.new or "") < 6 or len(body.new or "") > 64:
        raise HTTPException(status_code=400, detail="新密码需 6-64 位")
    u.pw_hash = hash_password(body.new)
    db.commit()
    return {"ok": True}
