import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..deps import current_user
from ..security import decrypt_secret, encrypt_secret, mask_key

router = APIRouter(prefix="/api/keys", tags=["keys"])


class KeyIn(BaseModel):
    base: Optional[str] = None
    model: Optional[str] = None
    key: Optional[str] = None     # None=不改；""=清空；其它=覆盖为新的


def _get_or_create(uid: int, db: Session) -> models.UserKey:
    uk = db.get(models.UserKey, uid)
    if uk is None:
        uk = models.UserKey(user_id=uid)
        db.add(uk)
        db.flush()
    return uk


@router.get("")
def get_key(u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    uk = db.get(models.UserKey, u.id)
    raw = decrypt_secret(uk.key_enc) if uk else ""
    return {
        "ok": True,
        "base": (uk.base if uk else "") or "https://api.deepseek.com/v1",
        "model": (uk.model if uk else "") or "deepseek-chat",
        "hasKey": bool(raw),
        "masked": mask_key(raw),
        "updatedAt": (uk.updated_at if uk else 0),
    }


@router.put("")
def put_key(body: KeyIn, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    uk = _get_or_create(u.id, db)
    if body.base is not None:
        uk.base = body.base.strip() or "https://api.deepseek.com/v1"
    if body.model is not None:
        uk.model = body.model.strip() or "deepseek-chat"
    if body.key is not None:
        uk.key_enc = encrypt_secret(body.key.strip())
    uk.updated_at = int(time.time() * 1000)
    db.commit()
    raw = decrypt_secret(uk.key_enc)
    return {"ok": True, "hasKey": bool(raw), "masked": mask_key(raw), "base": uk.base, "model": uk.model}
