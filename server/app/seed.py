"""首次启动建库后写入预置账号与邀请码（幂等：已存在则跳过）。"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from . import models
from .config import SEED_INVITES, SEED_USERS
from .security import hash_password


def parse_users(s: str):
    out = []
    for part in (s or "").split(","):
        part = part.strip()
        if not part or ":" not in part:
            continue
        u, p = part.split(":", 1)
        u = u.strip()
        if u:
            out.append((u, p.strip()))
    return out


def parse_codes(s: str):
    return [c.strip() for c in (s or "").split(",") if c.strip()]


def run(db: Session) -> dict:
    created_users, created_codes = [], []
    for username, pwd in parse_users(SEED_USERS):
        if db.query(models.User).filter(models.User.username == username).first():
            continue
        db.add(models.User(username=username, pw_hash=hash_password(pwd), nickname=username))
        created_users.append(username)
    for code in parse_codes(SEED_INVITES):
        if db.query(models.InviteCode).filter(models.InviteCode.code == code).first():
            continue
        db.add(models.InviteCode(code=code))
        created_codes.append(code)
    if created_users or created_codes:
        db.commit()
    return {"users": created_users, "codes": created_codes}
