"""
Gmail OAuth2 routes.

GET /auth/gmail          — Redirect the user to Google's OAuth consent screen.
GET /auth/gmail/callback — Google posts the auth code here; we exchange it for
                           credentials and redirect back to a success page.
GET /auth/gmail/status   — JSON health-check: is Gmail authorised?

POST /auth/gmail/send    — (dev/admin) Send a test email.
"""

from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse, JSONResponse

from ..services.gmail_service import (
    build_auth_url,
    exchange_code,
    is_authenticated,
    send_email,
)

router = APIRouter(prefix="/auth/gmail", tags=["Gmail"])


@router.get("")
def gmail_login():
    """Redirect the user to Google's OAuth 2.0 consent screen."""
    try:
        auth_url = build_auth_url()
    except EnvironmentError as exc:
        return JSONResponse(
            status_code=500,
            content={"error": str(exc)},
        )
    return RedirectResponse(url=auth_url)


@router.get("/callback")
def gmail_callback(
    code: str = Query(..., description="Authorization code from Google"),
    error: str = Query(None, description="Error from Google (if any)"),
):
    """
    Google redirects here after the user grants/denies consent.

    On success: exchanges the code for credentials and returns a JSON
    confirmation. In a real app you'd redirect to your frontend instead.
    """
    if error:
        return JSONResponse(
            status_code=400,
            content={"error": f"OAuth error from Google: {error}"},
        )

    try:
        creds = exchange_code(code)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to exchange code: {exc}"},
        )

    return {
        "message": "Gmail authorised successfully.",
        "scopes": list(creds.scopes or []),
    }


@router.get("/status")
def gmail_status():
    """Return whether Gmail credentials are currently valid."""
    authenticated = is_authenticated()
    return {
        "authenticated": authenticated,
        "message": (
            "Gmail is authorised and ready to send emails."
            if authenticated
            else "Gmail is not authorised. Visit /auth/gmail to connect."
        ),
    }


@router.post("/send")
def gmail_send_test(
    to: str = Query(..., description="Recipient email address"),
    subject: str = Query(default="Test email from Recovery Agent"),
    body: str = Query(default="This is a test email sent via the Gmail API."),
):
    """Dev/admin endpoint: send a test email to verify the integration."""
    try:
        result = send_email(to=to, subject=subject, body_text=body)
        return {"message": "Email sent.", "gmail_message_id": result.get("id")}
    except RuntimeError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
