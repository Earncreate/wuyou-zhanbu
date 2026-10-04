"""配置：全部走环境变量，本地可直接跑（默认 SQLite），线上换成 Postgres 连接串即可。

线上务必设置：
  DATABASE_URL   postgresql://...   （Neon / Supabase 免费档）
  SECRET_KEY     随机长字符串       （JWT 签名 + API Key 加密，换了它旧数据里的 Key 会解不开）
"""
import os

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_dotenv() -> None:
    """读 server/.env 填进环境变量（本地方便，线上由平台注入）。

    优先级：已存在的环境变量 > .env。只读，不覆盖平台注入的值。
    """
    path = os.path.join(_BASE_DIR, ".env")
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


_load_dotenv()


def _b(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")


# 默认库固定落在 server/wyzb.db（按文件位置算绝对路径）。
# 若写成 sqlite:///./wyzb.db，库会跟着启动目录跑，换个目录启动就变成另一个空库，报 no such table。
_DEFAULT_SQLITE = "sqlite:///" + os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wyzb.db"
).replace("\\", "/")

DATABASE_URL = os.getenv("DATABASE_URL", _DEFAULT_SQLITE).strip()

# 生产环境必须覆盖：JWT 签名密钥 + API Key 加密主密钥（同一个值派生出两把钥匙）
SECRET_KEY = os.getenv("SECRET_KEY", "").strip() or "dev-only-secret-change-it-before-deploy"

# 安全底线：线上漏配 SECRET_KEY 会静默用开发密钥，等于 Key 根本没加密、任何人可伪造登录态。
# 设 APP_ENV=production（或 RENDER=true）时直接拒绝启动，别让这种状态摸到线上。
_APP_ENV = os.getenv("APP_ENV", "").strip().lower()
_IS_PROD = _APP_ENV in ("production", "prod") or os.getenv("RENDER", "").strip().lower() == "true"

if _IS_PROD and SECRET_KEY.startswith("dev-only"):
    raise RuntimeError(
        "生产环境必须设置 SECRET_KEY（随机长字符串）："
        "python -c \"import secrets;print(secrets.token_urlsafe(48))\"。"
        "它同时是 JWT 签名密钥与 API Key 加密主密钥，漏配等于数据裸奔。"
    )

ALLOWED_ORIGINS = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "*").split(",") if x.strip()] or ["*"]

TOKEN_DAYS = int(os.getenv("TOKEN_DAYS", "30"))
MAX_RECORDS = int(os.getenv("MAX_RECORDS", "500"))          # 每用户占卜记录上限
MAX_PAYLOAD = int(os.getenv("MAX_PAYLOAD", "200000"))       # 单条记录 JSON 字符上限

# 预置账号与邀请码（首次启动建库时写入，已存在则跳过；可用同名环境变量覆盖）
SEED_USERS = os.getenv("SEED_USERS", "root:886260,user:vxea418707")
SEED_INVITES = os.getenv("SEED_INVITES", "helloyao1,helloyao2,helloyao3,helloyao4,helloyao5")

# 关掉后可开放自由注册（默认必须邀请码）
INVITE_REQUIRED = _b("INVITE_REQUIRED", True)

# 有权限生成邀请码的账号（逗号分隔）
ADMIN_USERNAMES = os.getenv("ADMIN_USERNAMES", "root")

# 登录失败限流：同 IP+用户名 在窗口内最多失败 N 次
LOGIN_MAX_FAIL = int(os.getenv("LOGIN_MAX_FAIL", "8"))
LOGIN_WINDOW_SEC = int(os.getenv("LOGIN_WINDOW_SEC", "300"))
