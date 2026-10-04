import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models, seed  # noqa: F401  （models 用于建表）
from .config import ALLOWED_ORIGINS
from .db import Base, SessionLocal, engine
from .routers import admin, auth, keys, llm, records


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        info = seed.run(db)
        if info["users"] or info["codes"]:
            print("[seed] 新建账号 %s，邀请码 %s" % (info["users"], info["codes"]), flush=True)
    finally:
        db.close()
    yield


app = FastAPI(title="无忧占卜 云同步服务", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(records.router)
app.include_router(keys.router)
app.include_router(llm.router)


@app.get("/api/health")
def health():
    return {"ok": True, "ts": int(time.time())}


@app.get("/")
def root():
    return {"ok": True, "service": "wyzb-sync", "docs": "/docs"}
