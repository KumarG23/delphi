from __future__ import annotations

import inspect
import os
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from paypal_parser import parse_paypal_pdf

Authenticator = Callable[[str], dict[str, Any] | None | Awaitable[dict[str, Any] | None]]
DEFAULT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024


async def verify_supabase_token(token: str) -> dict[str, Any] | None:
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "")
    if not base_url or not anon_key:
        return None
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{base_url}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": anon_key},
        )
    if response.status_code != 200:
        return None
    return response.json()


def create_app(
    *,
    authenticator: Authenticator = verify_supabase_token,
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
) -> FastAPI:
    app = FastAPI(title="Delphi Statement Importer", docs_url=None, redoc_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://delphi.sharma-house.com", "http://localhost:8081"],
        allow_methods=["POST", "GET"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/v1/statements/parse")
    async def parse_statement(
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authentication required.")
        token = authorization.removeprefix("Bearer ").strip()
        user = authenticator(token)
        if inspect.isawaitable(user):
            user = await user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session.")

        content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
        if content_type not in {"application/pdf", "application/octet-stream"}:
            raise HTTPException(status_code=415, detail="Choose a PDF statement.")

        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > max_upload_bytes:
                    raise HTTPException(status_code=413, detail="Statement exceeds the 15 MB limit.")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid Content-Length header.") from exc

        payload = bytearray()
        async for body_chunk in request.stream():
            payload.extend(body_chunk)
            if len(payload) > max_upload_bytes:
                payload.clear()
                raise HTTPException(status_code=413, detail="Statement exceeds the 15 MB limit.")
        if not payload:
            raise HTTPException(status_code=400, detail="Statement file is empty.")

        if len(payload) > max_upload_bytes:
            raise HTTPException(status_code=413, detail="Statement exceeds the 15 MB limit.")

        try:
            return parse_paypal_pdf(bytes(payload))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    return app


app = create_app()
