"""
Gmail OAuth2 service.

Environment variables required:
    GMAIL_CLIENT_ID      — OAuth 2.0 client ID from Google Cloud Console
    GMAIL_CLIENT_SECRET  — OAuth 2.0 client secret
    GMAIL_REDIRECT_URI   — Must match the URI registered in Google Cloud Console
                           e.g. http://localhost:8000/auth/gmail/callback
    GMAIL_TOKEN_FILE     — (optional) Path to persist the token JSON on disk.
                           Defaults to "gmail_token.json" next to this file.

Scopes granted:
    gmail.send  — send mail on behalf of the authenticated user
"""

from __future__ import annotations

import base64
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ── Constants ──────────────────────────────────────────────────────────────────

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

_DEFAULT_TOKEN = Path(__file__).parent / "gmail_token.json"
_TOKEN_FILE = Path(os.environ.get("GMAIL_TOKEN_FILE", str(_DEFAULT_TOKEN)))

# Module-level cache: holds the Flow object between build_auth_url() and
# exchange_code() so that the PKCE code_verifier is preserved.
# This is safe for a single-process server (uvicorn with 1 worker).
_pending_flow: Optional["Flow"] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _client_config() -> dict:
    """Build a client_config dict from env vars (avoids storing secrets.json)."""
    client_id = os.environ.get("GMAIL_CLIENT_ID", "")
    client_secret = os.environ.get("GMAIL_CLIENT_SECRET", "")
    redirect_uri = os.environ.get(
        "GMAIL_REDIRECT_URI", "http://localhost:8000/auth/gmail/callback"
    )

    if not client_id or not client_secret:
        raise EnvironmentError(
            "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in the environment."
        )

    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }


def build_auth_url() -> str:
    """Return the Google OAuth2 authorization URL to redirect the user to.

    The Flow object is cached in ``_pending_flow`` so that the PKCE
    code_verifier survives until ``exchange_code()`` is called.
    """
    global _pending_flow

    redirect_uri = os.environ.get(
        "GMAIL_REDIRECT_URI", "http://localhost:8000/auth/gmail/callback"
    )
    flow = Flow.from_client_config(
        _client_config(),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    auth_url, _state = flow.authorization_url(
        access_type="offline",    # request a refresh token
        include_granted_scopes="true",
        prompt="consent",         # always show consent so we get refresh_token
    )
    # Cache the flow so exchange_code() can reuse the same code_verifier.
    _pending_flow = flow
    return auth_url


def exchange_code(code: str) -> Credentials:
    """
    Exchange an authorization code for credentials and persist them to disk.

    Reuses the Flow cached by ``build_auth_url()`` so that the PKCE
    code_verifier matches what was sent to Google.

    Returns the Credentials object.
    """
    global _pending_flow

    if _pending_flow is not None:
        # Reuse the same Flow instance to preserve the code_verifier.
        flow = _pending_flow
        _pending_flow = None  # consume it so it isn't reused accidentally
    else:
        # Fallback: build a fresh flow without PKCE (works if Google didn't
        # require a verifier, e.g. desktop app flow).
        redirect_uri = os.environ.get(
            "GMAIL_REDIRECT_URI", "http://localhost:8000/auth/gmail/callback"
        )
        flow = Flow.from_client_config(
            _client_config(),
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )

    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_credentials(creds)
    return creds


def _save_credentials(creds: Credentials) -> None:
    """Persist credentials to the token file."""
    _TOKEN_FILE.write_text(creds.to_json())


def _load_credentials() -> Optional[Credentials]:
    """Load credentials from the token file, refreshing if expired."""
    if not _TOKEN_FILE.exists():
        return None

    creds = Credentials.from_authorized_user_file(str(_TOKEN_FILE), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            _save_credentials(creds)
        except RefreshError:
            # Token is revoked or invalid — force re-auth
            _TOKEN_FILE.unlink(missing_ok=True)
            return None

    return creds if creds and creds.valid else None


def get_credentials() -> Optional[Credentials]:
    """Public accessor: returns valid credentials or None (auth needed)."""
    return _load_credentials()


def is_authenticated() -> bool:
    """True if we have valid stored credentials."""
    return _load_credentials() is not None


# ── Gmail API ──────────────────────────────────────────────────────────────────

def _build_service(creds: Credentials):
    """Build and return a Gmail API service resource."""
    return build("gmail", "v1", credentials=creds)


def _make_message(
    to: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    from_email: Optional[str] = None,
) -> dict:
    """Build a base64url-encoded Gmail API message payload."""
    msg = MIMEMultipart("alternative")
    msg["To"] = to
    msg["Subject"] = subject
    if from_email:
        msg["From"] = from_email

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return {"raw": raw}


def send_email(
    to: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    from_email: Optional[str] = None,
) -> dict:
    """
    Send an email via the Gmail API.

    Args:
        to:         Recipient email address.
        subject:    Email subject line.
        body_text:  Plain-text body (always required as fallback).
        body_html:  Optional HTML body (sent as alternative part).
        from_email: Optional From address (defaults to authenticated account).

    Returns:
        The Gmail API message resource dict on success.

    Raises:
        RuntimeError: If not authenticated or the API call fails.
    """
    creds = _load_credentials()
    if creds is None:
        raise RuntimeError(
            "Gmail not authenticated. Visit /auth/gmail to authorise."
        )

    try:
        service = _build_service(creds)
        message = _make_message(to, subject, body_text, body_html, from_email)
        result = (
            service.users()
            .messages()
            .send(userId="me", body=message)
            .execute()
        )
        return result
    except HttpError as exc:
        raise RuntimeError(f"Gmail API error: {exc}") from exc
