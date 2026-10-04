"""可选通道：让大模型请求走服务端，浏览器里就完全不出现 Key。

不登录也能用（前端直连）。登录 + 保存过 Key 后，前端可以把请求改走这里，
服务端取出库里解密后的 Key 代发，返回与 DeepSeek 完全一致的 SSE 流。
"""
import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..deps import current_user
from ..schemas import ChatIn
from ..security import decrypt_secret

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.post("/chat")
async def chat(body: ChatIn, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    uk = db.get(models.UserKey, u.id)
    base = (body.base or (uk.base if uk else "") or "https://api.deepseek.com/v1").rstrip("/")
    model = body.model or (uk.model if uk else "") or "deepseek-chat"
    key = body.key or (decrypt_secret(uk.key_enc) if uk else "")
    if not key:
        raise HTTPException(status_code=400, detail="未配置 API Key")
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages 为空")

    url = base + "/chat/completions"
    payload = {
        "model": model,
        "messages": body.messages,
        "temperature": body.temperature,
        "stream": True,
    }
    headers = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}

    async def gen():
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=20.0)) as cli:
            try:
                async with cli.stream("POST", url, json=payload, headers=headers) as resp:
                    if resp.status_code != 200:
                        raw = await resp.aread()
                        msg = raw.decode("utf-8", "ignore")[:300]
                        yield "data: " + json.dumps(
                            {"error": {"message": "上游 HTTP %d：%s" % (resp.status_code, msg)}},
                            ensure_ascii=False,
                        ) + "\n\n"
                        return
                    async for chunk in resp.aiter_bytes():
                        if chunk:
                            yield chunk
            except Exception as e:
                yield "data: " + json.dumps(
                    {"error": {"message": "代理请求失败：%s" % str(e)[:200]}}, ensure_ascii=False
                ) + "\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
