from sqlalchemy import Column, Integer, String, BigInteger, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint, Index
from sqlalchemy.sql import func

from .db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(32), unique=True, nullable=False, index=True)
    pw_hash = Column(String(128), nullable=False)
    nickname = Column(String(64), default="")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)


class InviteCode(Base):
    __tablename__ = "invite_codes"
    id = Column(Integer, primary_key=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Record(Base):
    """占卜记录。rec_id 由客户端生成（'r'+随机），多端同步靠它去重。

    payload 存整条记录的 JSON（卦象、解读正文、反馈等），
    deleted 用软删，这样 A 端删掉的记录能同步到 B 端，而不是下次又被推回来。

    feedback_* 三列是从 payload['feedback'] 冗余出来的：统计要跨用户聚合，
    不能每次全表扫 JSON。同步写入时由 routers/records.py 的 _apply_feedback 保持与 payload 一致。
    """
    __tablename__ = "records"
    __table_args__ = (
        UniqueConstraint("user_id", "rec_id", name="uq_user_rec"),
        Index("ix_records_user_updated", "user_id", "server_updated_at"),
        Index("ix_records_user_fb", "user_id", "feedback_level"),
    )
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rec_id = Column(String(64), nullable=False)
    payload = Column(JSON, nullable=False)
    module_id = Column(String(32), default="", index=True)
    gua = Column(String(64), default="")
    client_updated_at = Column(BigInteger, default=0, nullable=False)   # 客户端毫秒时间戳
    server_updated_at = Column(BigInteger, default=0, nullable=False)   # 服务端写入时刻，增量拉取用它
    deleted = Column(Boolean, default=False, nullable=False)
    # ---- 应验反馈（冗余列，供统计；0 表示未反馈）----
    feedback_level = Column(Integer, default=0, nullable=False, index=True)   # 1未应验 2大致 3基本 4完全 5未到应期
    feedback_at = Column(BigInteger, default=0, nullable=False)
    feedback_note = Column(Text, default="")


class UserKey(Base):
    """用户自带的大模型 Key，密文存储。"""
    __tablename__ = "user_keys"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    base = Column(String(256), default="https://api.deepseek.com/v1")
    model = Column(String(64), default="deepseek-chat")
    key_enc = Column(Text, default="")
    updated_at = Column(BigInteger, default=0, nullable=False)
