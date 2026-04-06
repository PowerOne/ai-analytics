"""Internal service authentication (shared secret)."""

from __future__ import annotations

from fastapi import Header, HTTPException, status

from learning_analytics_ai.config import settings


async def verify_internal_api_key(
    x_internal_key: str | None = Header(None, alias="X-Internal-Key"),
) -> None:
    """
    If INTERNAL_API_KEY is configured, require matching X-Internal-Key header.
    If unset (local dev only), allow requests — never deploy production without a key.
    """
    expected = (settings.internal_api_key or "").strip()
    if not expected:
        return
    if not x_internal_key or x_internal_key != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing internal API key",
        )
