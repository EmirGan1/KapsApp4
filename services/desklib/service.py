import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from model import MAX_CHARS, MODEL_ID, REVISION, Detector

MAX_BODY = 320 * 1024
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app):
    start = time.monotonic()
    app.state.detector = Detector()
    app.state.lock = asyncio.Lock()
    app.state.load_ms = round((time.monotonic() - start) * 1000)
    logger.info("Desklib loaded and warmed in %d ms", app.state.load_ms)
    yield


app = FastAPI(lifespan=lifespan, openapi_url=None, docs_url=None, redoc_url=None)


def reply(payload, status=200):
    return JSONResponse(payload, status_code=status, headers={"Cache-Control": "no-store"})


@app.get("/healthz")
async def health():
    return reply({"model": MODEL_ID, "revision": REVISION, "ready": True,
                  "busy": app.state.lock.locked(), "loadMs": app.state.load_ms})


@app.post("/infer")
async def infer(request: Request):
    if app.state.lock.locked():
        return reply({"error": "busy"}, 429)
    async with app.state.lock:
        if request.headers.get("content-type") != "application/json":
            return reply({"error": "invalid_request"}, 415)
        body = bytearray()
        try:
            async with asyncio.timeout(5):
                async for chunk in request.stream():
                    if len(body) + len(chunk) > MAX_BODY:
                        return reply({"error": "oversized"}, 413)
                    body.extend(chunk)
            data = json.loads(body)
            text = data.get("text") if isinstance(data, dict) else None
            del data
            if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHARS:
                return reply({"error": "invalid_request"}, 400)
            # Reject lone surrogates without sending an exception containing input.
            text.encode("utf-8")
        except (ValueError, TimeoutError):
            return reply({"error": "invalid_request"}, 400)
        except Exception:
            return reply({"error": "request_unavailable"}, 400)
        finally:
            body.clear()
        try:
            return reply(await run_in_threadpool(app.state.detector.analyze, text))
        except Exception:
            logger.warning("Desklib inference failed")
            return reply({"error": "inference_failed"}, 503)
