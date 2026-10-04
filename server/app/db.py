"""数据库：本地 SQLite / 线上 Postgres 同一套代码，靠 DATABASE_URL 切换。"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import DATABASE_URL


def _normalize(url: str) -> str:
    # Supabase/Neon 面板给的常是 postgres:// 或 postgresql://，统一成 psycopg3 驱动
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    # 云端 Postgres 一律要求 SSL；本地回环不加
    if url.startswith("postgresql") and "sslmode" not in url:
        if "localhost" not in url and "127.0.0.1" not in url and "@db." not in url:
            url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


SQLALCHEMY_URL = _normalize(DATABASE_URL)
IS_SQLITE = SQLALCHEMY_URL.startswith("sqlite")

if IS_SQLITE:
    engine = create_engine(SQLALCHEMY_URL, connect_args={"check_same_thread": False}, future=True)
else:
    # 免费档 Postgres（Neon）空闲会挂起，pool_pre_ping 负责丢弃失效连接
    connect_args = {}
    # Supabase 的 pooler（pgbouncer）走 transaction 模式时不支持服务端预编译语句，
    # psycopg3 默认会自动 prepare，撞上会报 prepared statement does not exist；一律关掉最稳
    if "pooler.supabase" in SQLALCHEMY_URL:
        connect_args["prepare_threshold"] = None
    engine = create_engine(
        SQLALCHEMY_URL,
        pool_pre_ping=True,
        pool_size=int(os.getenv("DB_POOL_SIZE", "3")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "2")),
        pool_recycle=1800,
        future=True,
        connect_args=connect_args,
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    """FastAPI 依赖：每个请求一个会话，结束即关。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
