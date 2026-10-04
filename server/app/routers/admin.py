"""管理员接口：生成/查看邀请码、查看全站应验统计与反馈明细。

默认只有 root 能用（ADMIN_USERNAMES 环境变量可改）。
"""
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models
from .. import feedback as FB
from ..config import ADMIN_USERNAMES
from ..db import get_db
from ..deps import current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

ALPHABET = string.ascii_lowercase + string.digits


def _is_admin(u: models.User) -> bool:
    names = [x.strip().lower() for x in (ADMIN_USERNAMES or "").split(",") if x.strip()]
    return (u.username or "").lower() in names


def _gen(n: int = 10) -> str:
    return "wy" + "".join(secrets.choice(ALPHABET) for _ in range(n))


@router.post("/invites")
def create_invites(
    count: int = Query(1, ge=1, le=50),
    code: str = Query("", description="指定邀请码；留空则随机生成"),
    u: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not _is_admin(u):
        raise HTTPException(status_code=403, detail="无权限")
    made = []
    if code:
        if db.query(models.InviteCode).filter(models.InviteCode.code == code).first():
            raise HTTPException(status_code=400, detail="该邀请码已存在")
        db.add(models.InviteCode(code=code))
        made.append(code)
    else:
        for _ in range(count):
            c = _gen()
            while db.query(models.InviteCode).filter(models.InviteCode.code == c).first():
                c = _gen()
            db.add(models.InviteCode(code=c))
            made.append(c)
    db.commit()
    return {"ok": True, "codes": made}


@router.get("/invites")
def list_invites(only_unused: bool = True, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not _is_admin(u):
        raise HTTPException(status_code=403, detail="无权限")
    q = db.query(models.InviteCode)
    if only_unused:
        q = q.filter(models.InviteCode.used_by.is_(None))
    rows = q.order_by(models.InviteCode.id.asc()).all()
    return {"ok": True, "codes": [{"code": r.code, "used": r.used_by is not None} for r in rows]}


# ---------------------------------------------------------------- 应验统计

@router.get("/stats")
def site_stats(u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """全站应验统计：所有用户的反馈都会汇总到这里（管理员可见）。

    这是「我给了别人邀请码，他的反馈会不会到我这儿」的答案入口——
    只要对方登录过并同步过，他的 feedback 就在云端，root 在这里能看到汇总。
    """
    if not _is_admin(u):
        raise HTTPException(status_code=403, detail="无权限")

    live = db.query(models.Record).filter(models.Record.deleted.is_(False))

    total_records = live.count()
    total_users = db.query(func.count(models.User.id)).scalar() or 0
    # 真正反馈过的用户数：至少有一条 feedback_level 非 0 的记录
    fb_users = db.query(func.count(func.distinct(models.Record.user_id))).filter(
        models.Record.deleted.is_(False), models.Record.feedback_level > 0
    ).scalar() or 0

    overall = FB.summarize([r.feedback_level for r in live.all()])

    # 按模块
    mod_rows = db.query(
        models.Record.module_id,
        func.count(models.Record.id),
        models.Record.feedback_level,
    ).filter(models.Record.deleted.is_(False)).group_by(
        models.Record.module_id, models.Record.feedback_level
    ).all()
    by_mod = {}
    for mid, cnt, lv in mod_rows:
        by_mod.setdefault(mid or "general", []).extend([lv] * cnt)
    modules = []
    for mid, lvs in sorted(by_mod.items(), key=lambda kv: -len(kv[1])):
        s = FB.summarize(lvs)
        s["moduleId"] = mid
        s["total"] = len(lvs)
        modules.append(s)

    # 按卦（只看有反馈的）
    gua_rows = db.query(
        models.Record.gua, models.Record.feedback_level
    ).filter(models.Record.deleted.is_(False), models.Record.feedback_level > 0).all()
    by_gua = {}
    for g, lv in gua_rows:
        by_gua.setdefault(g or "—", []).append(lv)
    guas = []
    for g, lvs in sorted(by_gua.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        s = FB.summarize(lvs)
        s["gua"] = g
        s["total"] = len(lvs)
        guas.append(s)

    # 按用户：谁在用、谁在反馈、谁的卦最准
    users = db.query(models.User).all()
    uid2name = {x.id: x.username for x in users}
    per_user = {}
    for r in db.query(models.Record).filter(models.Record.deleted.is_(False)).all():
        per_user.setdefault(r.user_id, []).append(r)
    user_rows = []
    for uid, recs in per_user.items():
        s = FB.summarize([x.feedback_level for x in recs])
        last = max([x.server_updated_at for x in recs] or [0])
        user_rows.append({
            "username": uid2name.get(uid, "?#" + str(uid)),
            "total": len(recs),
            "feedbackCount": s["feedbackCount"],
            "conclusive": s["conclusive"],
            "rate": s["rate"],
            "dist": s["dist"],
            "lastAt": last,
        })
    user_rows.sort(key=lambda x: (-x["total"], x["username"]))

    return {
        "ok": True,
        "users": total_users,
        "usersWithFeedback": fb_users,
        "records": total_records,
        "overall": overall,
        "modules": modules,
        "guas": guas[:20],
        "perUser": user_rows,
        "levelNames": FB.LEVEL_NAMES,
    }


@router.get("/feedback")
def site_feedback(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    level: int = Query(0, ge=0, le=5, description="按等级过滤；0 表示全部"),
    username: str = Query("", description="按用户名过滤"),
    u: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """反馈明细：逐条看别人填了什么，含备注原文。按反馈时间倒序。"""
    if not _is_admin(u):
        raise HTTPException(status_code=403, detail="无权限")

    q = db.query(models.Record).filter(
        models.Record.deleted.is_(False), models.Record.feedback_level > 0
    )
    if level:
        q = q.filter(models.Record.feedback_level == level)
    if username:
        uid = db.query(models.User.id).filter(models.User.username == username).scalar()
        if not uid:
            return {"ok": True, "total": 0, "items": []}
        q = q.filter(models.Record.user_id == uid)

    total = q.count()
    rows = q.order_by(models.Record.feedback_at.desc()).offset(offset).limit(limit).all()
    uid2name = {x.id: x.username for x in db.query(models.User).all()}

    items = []
    for r in rows:
        p = r.payload if isinstance(r.payload, dict) else {}
        items.append({
            "username": uid2name.get(r.user_id, "?"),
            "recId": r.rec_id,
            "moduleId": r.module_id,
            "gua": r.gua,
            "question": str(p.get("text") or "")[:200],
            "level": r.feedback_level,
            "levelName": FB.LEVEL_NAMES.get(r.feedback_level, "?"),
            "note": r.feedback_note,
            "at": r.feedback_at,
            "createdAt": p.get("createdAt"),
        })
    return {"ok": True, "total": total, "limit": limit, "offset": offset, "items": items}


@router.post("/backfill")
def backfill_feedback(u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """把历史记录 payload 里的 feedback 回填到冗余列上。

    只在两种情况下需要：给已经跑过一段时间的库加了反馈列之后，
    或者哪天改动了提取逻辑。正常情况下 sync 会自动维护，不用手动跑。
    """
    if not _is_admin(u):
        raise HTTPException(status_code=403, detail="无权限")
    n = 0
    for r in db.query(models.Record).all():
        lv, at, note = FB.extract(r.payload)
        if (r.feedback_level, r.feedback_at, r.feedback_note) != (lv, at, note):
            r.feedback_level, r.feedback_at, r.feedback_note = lv, at, note
            n += 1
    db.commit()
    return {"ok": True, "updated": n}
