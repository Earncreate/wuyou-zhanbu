import json
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from .. import models
from ..config import MAX_PAYLOAD, MAX_RECORDS
from ..db import get_db
from ..deps import current_user
from ..schemas import SyncIn
from .. import feedback as FB

router = APIRouter(prefix="/api/records", tags=["records"])


def _apply_feedback(r: models.Record, payload):
    """把 payload 里的 feedback 同步到冗余列上。统计靠列，明细靠 payload，两处必须一致。"""
    lv, at, note = FB.extract(payload)
    r.feedback_level = lv
    r.feedback_at = at
    r.feedback_note = note


def _row(r: models.Record):
    return {
        "id": r.rec_id,
        "payload": r.payload,
        "updatedAt": r.client_updated_at,
        "serverUpdatedAt": r.server_updated_at,
        "deleted": r.deleted,
    }


@router.post("/sync")
def sync(body: SyncIn, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """一次请求完成「推 + 拉」：

    推：客户端把本地变更（updatedAt 更新的）发上来，冲突以时间戳大的为准。
    拉：返回服务端自 since 之后的所有变更（含软删标记），客户端据此增删改本地。
    """
    now = int(time.time() * 1000)
    applied = 0
    stale = []          # 客户端推了更旧的版本被拒：把服务端这份强制回传，别让客户端一直留着错的
    total = db.query(func.count(models.Record.id)).filter(models.Record.user_id == u.id).scalar() or 0

    for ch in body.changes:
        rid = (ch.id or "").strip()
        if not rid:
            continue
        try:
            size = len(json.dumps(ch.payload, ensure_ascii=False))
        except Exception:
            size = MAX_PAYLOAD + 1
        if size > MAX_PAYLOAD:
            continue

        r = db.query(models.Record).filter(
            models.Record.user_id == u.id, models.Record.rec_id == rid
        ).first()
        if r is None:
            if total >= MAX_RECORDS:
                continue
            r = models.Record(user_id=u.id, rec_id=rid)
            db.add(r)
            total += 1
        elif ch.updatedAt and ch.updatedAt < r.client_updated_at:
            stale.append(r.rec_id)
            continue          # 手上这份比服务端的旧，别覆盖（但要把正确的回传下去）

        r.payload = ch.payload
        r.module_id = str((ch.payload or {}).get("moduleId") or "")[:32]
        r.gua = str((ch.payload or {}).get("gua") or "")[:64]
        r.client_updated_at = ch.updatedAt or now
        r.server_updated_at = now
        r.deleted = bool(ch.deleted)
        _apply_feedback(r, ch.payload)
        applied += 1

    db.commit()

    q = db.query(models.Record).filter(models.Record.user_id == u.id)
    if body.since:
        if stale:
            q = q.filter(or_(models.Record.server_updated_at > body.since,
                             models.Record.rec_id.in_(stale)))
        else:
            q = q.filter(models.Record.server_updated_at > body.since)
    rows = q.order_by(models.Record.server_updated_at.asc()).all()
    return {
        "ok": True,
        "serverTime": now,
        "applied": applied,
        "conflicts": len(stale),
        "total": total,
        "records": [_row(r) for r in rows],
    }


@router.get("/stats")
def my_stats(u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """本人应验统计：按模块分组 + 总体。数据只属于调用者自己。"""
    rows = db.query(models.Record).filter(
        models.Record.user_id == u.id, models.Record.deleted.is_(False)
    ).all()

    total = len(rows)
    overall = FB.summarize([r.feedback_level for r in rows])

    by_mod = {}
    for r in rows:
        mid = r.module_id or "general"
        by_mod.setdefault(mid, []).append(r.feedback_level)
    modules = []
    for mid, lvs in sorted(by_mod.items(), key=lambda kv: -len(kv[1])):
        s = FB.summarize(lvs)
        s["moduleId"] = mid
        s["total"] = len(lvs)
        modules.append(s)

    by_gua = {}
    for r in rows:
        if r.feedback_level:
            by_gua.setdefault(r.gua or "—", []).append(r.feedback_level)
    guas = []
    for g, lvs in sorted(by_gua.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        s = FB.summarize(lvs)
        s["gua"] = g
        s["total"] = len(lvs)
        guas.append(s)

    return {
        "ok": True,
        "username": u.username,
        "total": total,
        "overall": overall,
        "modules": modules,
        "guas": guas[:20],
        "levelNames": FB.LEVEL_NAMES,
    }


@router.get("")
def list_records(since: int = 0, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(models.Record).filter(models.Record.user_id == u.id)
    if since:
        q = q.filter(models.Record.server_updated_at > since)
    rows = q.order_by(models.Record.server_updated_at.asc()).all()
    return {"ok": True, "records": [_row(r) for r in rows]}


@router.delete("/{rec_id}")
def delete_record(rec_id: str, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.query(models.Record).filter(
        models.Record.user_id == u.id, models.Record.rec_id == rec_id
    ).first()
    if not r:
        return {"ok": True, "deleted": 0}
    r.deleted = True
    r.server_updated_at = int(time.time() * 1000)
    db.commit()
    return {"ok": True, "deleted": 1}


@router.delete("")
def clear_records(u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """清空：物理删除，省得软删数据占着免费额度。"""
    n = db.query(models.Record).filter(models.Record.user_id == u.id).delete()
    db.commit()
    return {"ok": True, "deleted": n}
