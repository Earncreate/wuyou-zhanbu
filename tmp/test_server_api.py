"""后端 API 冒烟测试：注册(邀请码) / 登录 / 记录同步 / Key 加密存取 / 鉴权。

跑法：先启动服务（uvicorn app.main:app --port 8123），再 python tmp/test_server_api.py
断言失败即以非零码退出，打印第一条失败原因。
"""
import sys
import time

import httpx

BASE = "http://127.0.0.1:8123"
PASS, FAIL = 0, []


def chk(name, cond, extra=""):
    global PASS
    if cond:
        PASS += 1
    else:
        FAIL.append("%s %s" % (name, extra))
        print("  FAIL %s %s" % (name, extra))


def main():
    c = httpx.Client(base_url=BASE, timeout=20)

    # 1 健康检查
    r = c.get("/api/health")
    chk("health", r.status_code == 200 and r.json().get("ok") is True, r.text[:80])

    # 2 预置账号登录
    r = c.post("/api/auth/login", json={"username": "root", "password": "886260"})
    chk("登录 root", r.status_code == 200, r.text[:120])
    tok_root = r.json().get("token", "") if r.status_code == 200 else ""
    chk("root 拿到 token", len(tok_root) > 20, tok_root[:20])

    r = c.post("/api/auth/login", json={"username": "user", "password": "vxea418707"})
    chk("登录 user", r.status_code == 200, r.text[:120])
    tok_user = r.json().get("token", "")

    # 3 错误密码
    r = c.post("/api/auth/login", json={"username": "root", "password": "wrong-password"})
    chk("错误密码 401", r.status_code == 401, r.text[:80])

    # 4 未登录访问受保护接口
    r = c.get("/api/records")
    chk("无 token 401", r.status_code == 401, r.text[:80])
    r = c.get("/api/records", headers={"Authorization": "Bearer fake.token.here"})
    chk("伪 token 401", r.status_code == 401, r.text[:80])

    # 5 邀请码：现场生成（脚本可反复跑，不消耗预置的 5 个码）
    r = c.post("/api/admin/invites?count=1", headers={"Authorization": "Bearer " + tok_root})
    chk("管理员生成邀请码", r.status_code == 200 and len(r.json().get("codes", [])) == 1, r.text[:80])
    code = r.json()["codes"][0]
    uname = "t" + str(int(time.time()))
    r = c.post("/api/admin/invites?count=1", headers={"Authorization": "Bearer " + tok_user})
    chk("普通用户不能发码", r.status_code == 403, r.text[:80])

    # 6 注册校验
    r = c.post("/api/auth/register", json={"username": uname, "password": "abc123"})
    chk("缺邀请码 400", r.status_code == 400, r.text[:80])
    r = c.post("/api/auth/register", json={"username": uname, "password": "abc123", "invite_code": "badcode"})
    chk("无效邀请码 400", r.status_code == 400, r.text[:80])
    r = c.post("/api/auth/register", json={"username": "ab", "password": "abc123", "invite_code": code})
    chk("用户名过短 422", r.status_code == 422, r.text[:80])
    r = c.post("/api/auth/register", json={"username": uname, "password": "123", "invite_code": code})
    chk("密码过短 422", r.status_code == 422, r.text[:80])

    # 7 正常注册 + 邀请码一次性
    r = c.post("/api/auth/register", json={"username": uname, "password": "abc123", "invite_code": code})
    chk("邀请码注册成功", r.status_code == 200, r.text[:120])
    tok_n1 = r.json().get("token", "")
    r = c.post("/api/auth/register", json={"username": uname + "b", "password": "abc123", "invite_code": code})
    chk("邀请码不可复用", r.status_code == 400 and "已被使用" in r.text, r.text[:120])
    r = c.post("/api/admin/invites?count=1", headers={"Authorization": "Bearer " + tok_root})
    code2 = r.json()["codes"][0]
    r = c.post("/api/auth/register", json={"username": uname, "password": "abc123", "invite_code": code2})
    chk("用户名不可重复", r.status_code == 400, r.text[:120])

    # 8 me
    r = c.get("/api/auth/me", headers={"Authorization": "Bearer " + tok_n1})
    chk("me 返回用户名", r.status_code == 200 and r.json().get("username") == uname, r.text[:80])

    # 8 记录同步：推 2 条
    now = int(time.time() * 1000)
    changes = [
        {"id": "rA", "updatedAt": now, "payload": {"moduleId": "career", "gua": "乾为天", "text": "问工作"}},
        {"id": "rB", "updatedAt": now, "payload": {"moduleId": "wealth", "gua": "巽为风", "text": "问财运"}},
    ]
    r = c.post("/api/records/sync", json={"since": 0, "changes": changes},
               headers={"Authorization": "Bearer " + tok_root})
    j = r.json()
    chk("推送 2 条", r.status_code == 200 and j.get("applied") == 2, r.text[:120])
    chk("拉回 2 条", len(j.get("records", [])) == 2, str(len(j.get("records", []))))

    # 9 旧数据不覆盖新数据
    r = c.post("/api/records/sync", json={"since": 0, "changes": [
        {"id": "rA", "updatedAt": now - 10000, "payload": {"moduleId": "old"}}]},
        headers={"Authorization": "Bearer " + tok_root})
    j = r.json()
    got = [x for x in j["records"] if x["id"] == "rA"]
    chk("旧时间戳不覆盖", got and got[0]["payload"].get("moduleId") == "career", str(got)[:120])

    # 10 新数据覆盖
    r = c.post("/api/records/sync", json={"since": 0, "changes": [
        {"id": "rA", "updatedAt": now + 10000, "payload": {"moduleId": "new"}}]},
        headers={"Authorization": "Bearer " + tok_root})
    got = [x for x in r.json()["records"] if x["id"] == "rA"]
    chk("新时间戳覆盖", got and got[0]["payload"].get("moduleId") == "new", str(got)[:120])

    # 11 增量拉取
    t0 = r.json()["serverTime"]
    r = c.post("/api/records/sync", json={"since": t0, "changes": []},
               headers={"Authorization": "Bearer " + tok_root})
    chk("since 后无新增", len(r.json().get("records", [])) == 0, str(len(r.json().get("records", []))))
    r = c.post("/api/records/sync", json={"since": 0, "changes": [
        {"id": "rC", "updatedAt": int(time.time() * 1000), "payload": {"moduleId": "love"}}]},
        headers={"Authorization": "Bearer " + tok_root})
    chk("新增 rC 后增量可见", any(x["id"] == "rC" for x in r.json()["records"]), r.text[:100])

    # 12 删除同步（软删标记）
    r = c.delete("/api/records/rB", headers={"Authorization": "Bearer " + tok_root})
    chk("删除单条", r.status_code == 200 and r.json().get("deleted") == 1, r.text[:80])
    r = c.post("/api/records/sync", json={"since": 0, "changes": []},
               headers={"Authorization": "Bearer " + tok_root})
    got = [x for x in r.json()["records"] if x["id"] == "rB"]
    chk("删除带 deleted 标记同步回来", got and got[0]["deleted"] is True, str(got)[:120])

    # 13 数据隔离：user 看不到 root 的记录
    r = c.post("/api/records/sync", json={"since": 0, "changes": []},
               headers={"Authorization": "Bearer " + tok_user})
    chk("用户数据隔离", len(r.json().get("records", [])) == 0, str(len(r.json().get("records", []))))

    # 14 Key 加密存取
    r = c.put("/api/keys", json={"base": "https://api.deepseek.com/v1", "model": "deepseek-chat",
                                 "key": "sk-testkey1234567890"},
              headers={"Authorization": "Bearer " + tok_root})
    chk("保存 Key", r.status_code == 200 and r.json().get("hasKey") is True, r.text[:100])
    r = c.get("/api/keys", headers={"Authorization": "Bearer " + tok_root})
    j = r.json()
    chk("Key 只回传掩码", j.get("masked", "").startswith("sk-tes") and "4567890" not in j.get("masked", ""),
        str(j.get("masked")))
    chk("Key 不回明文", "sk-testkey1234567890" not in r.text, "")
    r = c.get("/api/keys", headers={"Authorization": "Bearer " + tok_user})
    chk("Key 用户隔离", r.json().get("hasKey") is False, r.text[:80])

    # 15 清空
    r = c.delete("/api/records", headers={"Authorization": "Bearer " + tok_root})
    chk("清空记录", r.status_code == 200 and r.json().get("deleted", 0) >= 2, r.text[:80])

    print("\n通过 %d 项，失败 %d 项" % (PASS, len(FAIL)))
    if FAIL:
        print("失败明细：")
        for f in FAIL:
            print(" -", f)
        sys.exit(1)
    print("后端 API 冒烟测试全部通过")


if __name__ == "__main__":
    main()
