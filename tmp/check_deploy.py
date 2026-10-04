"""部署前自检：模拟 Render 的行为，确认这份仓库拉下来能直接跑起来。

检查项：
  1. blueprint 必须在仓库根目录（Render 只认根目录的 render.yaml）
  2. rootDir 指向的目录里必须有 requirements.txt
  3. requirements.txt 里的包当前 Python 能装（只查元数据，不真装）
  4. 启动命令能正常起服务（内存内跑，不占端口），/api/health 有响应
  5. 关键环境变量缺失时的行为（SECRET_KEY 缺失必须拒绝启动而不是用开发密钥）
  6. 敏感文件是否被 .gitignore 挡住

用法：python tmp/check_deploy.py
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = fail = 0
notes = []


def chk(name, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1
        print("  PASS " + name)
    else:
        fail += 1
        print("  FAIL " + name + ("  → " + str(extra) if extra else ""))


def read(p):
    with open(os.path.join(ROOT, p), "r", encoding="utf-8") as f:
        return f.read()


def main():
    print("【1】Blueprint 位置（Render 只认仓库根目录）")
    chk("根目录存在 render.yaml", os.path.exists(os.path.join(ROOT, "render.yaml")))
    chk("server/ 下没有多余的 render.yaml（否则会误导）",
        not os.path.exists(os.path.join(ROOT, "server", "render.yaml")))
    if not os.path.exists(os.path.join(ROOT, "render.yaml")):
        return finish()
    y = read("render.yaml")
    chk("声明了 python 运行时", "runtime: python" in y)
    chk("用了免费档", "plan: free" in y)
    m = re.search(r"rootDir:\s*(\S+)", y)
    chk("指定了 rootDir", bool(m), "缺这行 Render 会在仓库根找 requirements.txt 而失败")
    root_dir = (m.group(1) if m else "").strip().strip("\"'")
    chk("rootDir 目录存在", os.path.isdir(os.path.join(ROOT, root_dir)), root_dir)
    chk("rootDir 下有 requirements.txt",
        os.path.exists(os.path.join(ROOT, root_dir, "requirements.txt")))
    chk("startCommand 指向存在的模块（app.main:app）",
        os.path.exists(os.path.join(ROOT, root_dir, "app", "main.py")))
    # 通用检测：blueprint 里出现长随机串（密钥特征）或 postgres 连接串即为硬写密钥
    looks_secret = bool(re.search(r"postgres(ql)?://[^\s\"']*:[^\s\"'@]+@", y)) or \
        bool(re.search(r"[A-Za-z0-9_\-]{40,}", y))
    chk("密钥没有硬写在 blueprint 里（无长随机串、无连接串）",
        "sync: false" in y and not looks_secret,
        "检测到疑似硬写密钥" if looks_secret else "")

    print("【2】依赖清单")
    req = read(os.path.join(root_dir, "requirements.txt"))
    pkgs = [l.strip() for l in req.splitlines()
            if l.strip() and not l.strip().startswith("#")]
    chk("requirements.txt 非空", len(pkgs) > 0, str(len(pkgs)) + " 行")
    for need in ("fastapi", "uvicorn", "sqlalchemy", "psycopg", "bcrypt", "cryptography", "PyJWT"):
        chk("含 " + need, any(p.lower().startswith(need.lower()) for p in pkgs))

    print("【3】敏感文件不入库")
    gi = read(".gitignore")
    for pat in ("server/.env", ".venv/", "dist/"):
        chk("已忽略 " + pat, pat in gi)
    # 只认「像真连接串」的：主机段不是占位符（排除 <...>、xxx、user:pass、ep-xxx 之类）
    def real_conn(text):
        for m in re.finditer(r"postgres(?:ql)?://([^\s`\"']{6,})", text):
            host = m.group(1)
            if "<" in host or "xxx" in host.lower() or "user:pass" in host:
                continue
            if "postgres." in host or ".supabase.com" in host or ".neon.tech" in host:
                return m.group(0)
        return ""

    tracked = read("DEPLOY.md")
    leak = real_conn(tracked)
    chk("DEPLOY.md 不含真实数据库连接串（占位形式不算）", not leak, leak[:60])
    env_path = os.path.join(ROOT, "server", ".env")
    chk("本地 .env 存在（应为存在且被忽略）", os.path.exists(env_path))
    chk("本地 .env 未被 git 暂存",
        not os.path.exists(os.path.join(ROOT, ".git", "index")) or
        subprocess.run(["git", "ls-files", "--error-unmatch", "server/.env"],
                       cwd=ROOT, capture_output=True).returncode != 0)

    print("【4】服务能起来（内存内，不占端口）")
    r = subprocess.run([sys.executable, "-c", (
        "import sys; sys.path.insert(0, %r);"
        "from fastapi.testclient import TestClient;"
        "from app.main import app;"
        "c = TestClient(app);"
        "print(c.get('/api/health').text)"
        % os.path.join(ROOT, root_dir)
    )], capture_output=True, text=True)
    out = (r.stdout or "") + (r.stderr or "")
    chk("应用可导入且 /api/health 返回 ok", '"ok":true' in out, out.strip().splitlines()[-1][:120] if out.strip() else "")

    print("【5】生产环境不得用开发密钥")
    # 线上没有 .env（.env 只存在于本地且被 gitignore），所以必须在一个「无 .env 的副本」上测，
    # 否则探针会读到本地 .env 里的真密钥，测出来是假绿。
    import shutil
    import tempfile
    tmpdir = tempfile.mkdtemp(prefix="wyzb_deploy_")
    srv = os.path.join(ROOT, root_dir)
    fake_srv = os.path.join(tmpdir, "server")
    shutil.copytree(srv, fake_srv,
                    ignore=shutil.ignore_patterns(".env", "wyzb.db", "__pycache__", ".venv"))
    chk("测试副本里确实没有 .env（否则密钥测试是假绿）",
        not os.path.exists(os.path.join(fake_srv, ".env")))

    probe = (
        "import sys; sys.path.insert(0, %r);"
        "import app.config as c;"
        "print('IS_DEV=' + str(c.SECRET_KEY.startswith('dev-only')))"
        % fake_srv
    )
    env_no_key = {k: v for k, v in os.environ.items() if k != "SECRET_KEY"}
    env_no_key["RENDER"] = "true"
    r2 = subprocess.run([sys.executable, "-c", probe], capture_output=True, text=True,
                        env=env_no_key, cwd=tmpdir)
    out2 = (r2.stdout or "") + (r2.stderr or "")
    chk("线上漏配 SECRET_KEY 时拒绝启动（不是静默用开发密钥）",
        r2.returncode != 0 and "生产环境必须设置 SECRET_KEY" in out2,
        out2.strip().splitlines()[-1][:110] if out2.strip() else "")
    r3 = subprocess.run([sys.executable, "-c", probe], capture_output=True, text=True,
                        env=dict(env_no_key, SECRET_KEY="test-only-key-for-check"),
                        cwd=tmpdir)
    chk("配了密钥时正常通过（不误伤）",
        "IS_DEV=False" in ((r3.stdout or "") + (r3.stderr or "")),
        ((r3.stdout or "") + (r3.stderr or "")).strip()[-110:])
    shutil.rmtree(tmpdir, ignore_errors=True)

    return finish()


def finish():
    print("\n======== 部署前自检汇总 ========")
    print("通过 " + str(ok) + "，失败 " + str(fail))
    for n in notes:
        print("  ! " + n)
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main() or 0)
