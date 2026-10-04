"""应验反馈闭环测试：反馈随记录上云 → 冗余列落地 → 本人/全站统计 → 明细可查。

断言点（口径与 server/app/feedback.py 一致）：
  1 未应验 / 2 大致应验 / 3 基本应验 / 4 完全应验 / 5 未到应期
  有结论 = 1..4（5 不计入分母）；应验率 = (2+3+4)/有结论
"""
import os
import random
import sys
import time

import httpx

BASE = "http://127.0.0.1:8123"
ok = fail = 0


def reset_fixture():
    """清掉上一轮留下的数据，让全站断言可重复跑（只动测试用户的记录，不动 root 账号）。

    统计断言是绝对值（全站 7 条之类），只要库里有残留就必然失败，
    所以宁可每轮开头清一次，也不要写「增量断言」那种永远看不出真问题的软断言。
    """
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))
    from app.db import SessionLocal
    from app import models
    d = SessionLocal()
    # Postgres 会强制外键，SQLite 默认不强制 —— 所以清理必须按依赖顺序来，
    # 否则本地全绿、线上第一次跑就 ForeignKeyViolation（invite_codes.used_by → users.id）。
    targets = []
    for pfx in ("fbA", "fbB", "fbU", "stU", "tester"):
        for u in d.query(models.User).filter(models.User.username.like(pfx + "%")).all():
            targets.append(u.id)
    if targets:
        d.query(models.InviteCode).filter(models.InviteCode.used_by.in_(targets)).update(
            {models.InviteCode.used_by: None}, synchronize_session=False)
        d.query(models.Record).filter(models.Record.user_id.in_(targets)).delete(synchronize_session=False)
        d.query(models.UserKey).filter(models.UserKey.user_id.in_(targets)).delete(synchronize_session=False)
        d.query(models.User).filter(models.User.id.in_(targets)).delete(synchronize_session=False)
    # 非预置邀请码（测试造的）一并清掉，否则下次 createInvites 的新码不唯一
    d.query(models.InviteCode).filter(models.InviteCode.code.notlike("helloyao%")).delete(synchronize_session=False)
    d.commit()
    d.close()


def chk(name, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1
        print("  PASS " + name)
    else:
        fail += 1
        print("  FAIL " + name + ("  << " + str(extra) if extra else ""))


def reg(c, uname, code):
    r = c.post("/api/auth/register", json={"username": uname, "password": "abc123", "invite_code": code})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def push(c, tok, rid, module, gua, fb=None):
    payload = {"moduleId": module, "gua": gua, "text": "测试问事", "createdAt": int(time.time() * 1000)}
    if fb:
        payload["feedback"] = fb
    return c.post("/api/records/sync", json={
        "since": 0,
        "changes": [{"id": rid, "updatedAt": int(time.time() * 1000), "payload": payload}],
    }, headers={"Authorization": "Bearer " + tok}).json()


def main():
    reset_fixture()
    c = httpx.Client(base_url=BASE, timeout=20)
    stamp = str(random.randint(10000, 99999))

    print("【1】管理员拿码、建两个普通用户")
    root_tok = c.post("/api/auth/login", json={"username": "root", "password": "886260"}).json()["token"]
    rh = {"Authorization": "Bearer " + root_tok}
    codes = c.post("/api/admin/invites?count=2", headers=rh).json()["codes"]
    chk("root 能生成邀请码", len(codes) == 2, codes)

    a = "fbA" + stamp
    b = "fbB" + stamp
    ta = reg(c, a, codes[0])
    tb = reg(c, b, codes[1])
    ha = {"Authorization": "Bearer " + ta}
    hb = {"Authorization": "Bearer " + tb}

    print("【2】A 推 4 条带反馈的记录（4 完全 / 3 基本 / 1 未应验 / 5 未到应期）")
    now = int(time.time() * 1000)
    push(c, ta, "rA1"+stamp, "wealth", "乾为天", {"level": 4, "at": now, "note": "真涨了"})
    push(c, ta, "rA2"+stamp, "wealth", "坤为地", {"level": 3, "at": now, "note": "大体对"})
    push(c, ta, "rA3"+stamp, "career", "水火既济", {"level": 1, "at": now, "note": "反了"})
    push(c, ta, "rA4"+stamp, "career", "火水未济", {"level": 5, "at": now, "note": "还没到时候"})
    push(c, ta, "rA5"+stamp, "career", "山泽损", None)      # 无反馈

    print("【3】B 推 2 条（都完全应验）")
    push(c, tb, "rB1"+stamp, "loveM", "泽山咸", {"level": 4, "at": now, "note": "成了"})
    push(c, tb, "rB2"+stamp, "loveM", "雷风恒", {"level": 2, "at": now, "note": "沾点边"})

    print("【4】本人统计：只能看到自己的")
    sa = c.get("/api/records/stats", headers=ha).json()
    chk("A 本人共 5 条", sa["total"] == 5, sa.get("total"))
    chk("A 已反馈 4 条", sa["overall"]["feedbackCount"] == 4, sa["overall"])
    chk("A 有结论 3 条（未到应期不计）", sa["overall"]["conclusive"] == 3, sa["overall"])
    chk("A 应验率 = 2/3 = 66.7%", sa["overall"]["rate"] == 66.7, sa["overall"]["rate"])
    chk("A 看不到 B 的模块 loveM",
        all(m["moduleId"] != "loveM" for m in sa["modules"]), [m["moduleId"] for m in sa["modules"]])

    sb = c.get("/api/records/stats", headers=hb).json()
    chk("B 本人 2 条", sb["total"] == 2, sb.get("total"))
    chk("B 应验率 = 2/2 = 100%", sb["overall"]["rate"] == 100.0, sb["overall"]["rate"])

    print("【5】全站统计（root）")
    st = c.get("/api/admin/stats", headers=rh).json()
    chk("全站记录数 = 7", st["records"] == 7, st.get("records"))
    chk("反馈过的用户数 = 2", st["usersWithFeedback"] == 2, st.get("usersWithFeedback"))
    chk("有结论 = 5（A3 + B2）", st["overall"]["conclusive"] == 5, st["overall"])
    chk("全站应验率 = 4/5 = 80%", st["overall"]["rate"] == 80.0, st["overall"]["rate"])
    # 此刻全站：rA1(4) rA2(3) rA3(1) rA4(5) rA5(无) rB1(4) rB2(2)
    chk("等级分布 dist[4]=2（A一条 B一条）", st["overall"]["dist"]["4"] == 2, st["overall"]["dist"])
    chk("等级分布 dist[5]=1", st["overall"]["dist"]["5"] == 1, st["overall"]["dist"])
    chk("等级分布 dist[3]=1", st["overall"]["dist"]["3"] == 1, st["overall"]["dist"])
    chk("等级分布 dist[1]=1", st["overall"]["dist"]["1"] == 1, st["overall"]["dist"])
    chk("等级分布 dist[0]=1（未反馈那条）", st["overall"]["dist"]["0"] == 1, st["overall"]["dist"])
    names = [x["username"] for x in st["perUser"]]
    chk("perUser 含 A 和 B", a in names and b in names, names)
    wa = [x for x in st["perUser"] if x["username"] == a][0]
    chk("perUser 里 A 的应验率与本人一致", wa["rate"] == 66.7, wa)
    mods = {m["moduleId"]: m["total"] for m in st["modules"]}
    chk("按模块：wealth=2, career=3, loveM=2", mods.get("wealth") == 2 and mods.get("career") == 3 and mods.get("loveM") == 2, mods)

    print("【6】反馈明细：逐条看别人填了什么")
    fb = c.get("/api/admin/feedback?limit=50", headers=rh).json()
    chk("明细条数 = 6", fb["total"] == 6, fb.get("total"))
    byuser = {x["username"] for x in fb["items"]}
    chk("明细里能同时看到 A 与 B 的反馈", byuser == {a, b}, byuser)
    note4 = [x for x in fb["items"] if x["note"] == "真涨了"]
    chk("备注原文可取到", len(note4) == 1 and note4[0]["levelName"] == "完全应验", note4)
    chk("明细带卦名与模块", note4[0]["gua"] == "乾为天" and note4[0]["moduleId"] == "wealth", note4[0])

    f2 = c.get("/api/admin/feedback?level=5", headers=rh).json()
    chk("按等级过滤：只出未到应期 1 条", f2["total"] == 1 and f2["items"][0]["level"] == 5, f2.get("total"))
    f3 = c.get("/api/admin/feedback?username=" + b, headers=rh).json()
    chk("按用户过滤：只出 B 的 2 条", f3["total"] == 2, f3.get("total"))

    print("【7】权限：普通用户碰不了全站数据")
    r = c.get("/api/admin/stats", headers=ha)
    chk("A 调 admin/stats → 403", r.status_code == 403, r.status_code)
    r = c.get("/api/admin/feedback", headers=ha)
    chk("A 调 admin/feedback → 403", r.status_code == 403, r.status_code)
    r = c.get("/api/records/stats")
    chk("未登录调本人统计 → 401", r.status_code == 401, r.status_code)

    print("【8】改反馈：覆盖旧值，统计跟着变")
    push(c, ta, "rA3"+stamp, "career", "水火既济", {"level": 4, "at": int(time.time() * 1000), "note": "改判：其实准了"})
    sa2 = c.get("/api/records/stats", headers=ha).json()
    chk("改后 A 应验率 = 3/3 = 100%", sa2["overall"]["rate"] == 100.0, sa2["overall"]["rate"])
    f4 = c.get("/api/admin/feedback?username=" + a, headers=rh).json()
    hit = [x for x in f4["items"] if x["recId"] == "rA3"+stamp]
    chk("明细里备注已更新", hit and hit[0]["note"] == "改判：其实准了", hit)

    print("【9】软删不进统计")
    c.delete("/api/records/rA1" + stamp, headers=ha)
    sa3 = c.get("/api/records/stats", headers=ha).json()
    chk("删掉 1 条后 A 剩 4 条", sa3["total"] == 4, sa3.get("total"))

    print("【10】backfill：冗余列被破坏后能从 payload 恢复")
    sys.path.insert(0, "server")
    from app.db import SessionLocal
    from app import models
    d = SessionLocal()
    victim = d.query(models.Record).filter(models.Record.rec_id == "rA2" + stamp).first()
    chk("目标记录存在", victim is not None)
    if victim:
        victim.feedback_level = 0
        victim.feedback_note = ""
        d.commit()
        mid = c.get("/api/admin/stats", headers=rh).json()
        # 此时 rA1 已软删、rA3 已改判为 4，剩余已反馈 = rA2 rA3 rA4 rB1 rB2 共 5 条，破坏 rA2 后应剩 4
        chk("破坏后少了一条反馈", mid["overall"]["feedbackCount"] == 4, mid["overall"]["feedbackCount"])
        bf = c.post("/api/admin/backfill", headers=rh).json()
        chk("backfill 至少修回 1 条", bf.get("updated", 0) >= 1, bf)
        after = c.get("/api/admin/stats", headers=rh).json()
        chk("backfill 后恢复 5 条反馈", after["overall"]["feedbackCount"] == 5, after["overall"]["feedbackCount"])
        got = d.query(models.Record).filter(models.Record.rec_id == "rA2" + stamp).first()
        chk("等级恢复为 3（基本应验）", got.feedback_level == 3, got.feedback_level)
        chk("备注恢复", got.feedback_note == "大体对", got.feedback_note)
    d.close()

    print("\n通过 %d，失败 %d" % (ok, fail))
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
