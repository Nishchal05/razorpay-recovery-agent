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
import json
import os
import re
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

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

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
    thread_id: Optional[str] = None,
    in_reply_to: Optional[str] = None,
) -> dict:
    """Build a base64url-encoded Gmail API message payload."""
    msg = MIMEMultipart("alternative")
    msg["To"] = to
    msg["Subject"] = subject
    if from_email:
        msg["From"] = from_email
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    payload = {"raw": raw}
    if thread_id:
        payload["threadId"] = thread_id
    return payload


def send_email(
    to: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    from_email: Optional[str] = None,
    thread_id: Optional[str] = None,
    in_reply_to: Optional[str] = None,
) -> dict:
    """
    Send an email via the Gmail API.

    Args:
        to:          Recipient email address.
        subject:     Email subject line.
        body_text:   Plain-text body (always required as fallback).
        body_html:   Optional HTML body (sent as alternative part).
        from_email:  Optional From address (defaults to authenticated account).
        thread_id:   Optional thread ID to reply within an existing thread.
        in_reply_to: Optional message ID to thread headers.

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
        message = _make_message(to, subject, body_text, body_html, from_email, thread_id, in_reply_to)
        result = (
            service.users()
            .messages()
            .send(userId="me", body=message)
            .execute()
        )
        return result
    except HttpError as exc:
        raise RuntimeError(f"Gmail API error: {exc}") from exc


_PROCESSED_IDS_FILE = _TOKEN_FILE.parent / "processed_gmail_ids.json"


def _load_processed_ids() -> set[str]:
    if _PROCESSED_IDS_FILE.exists():
        try:
            return set(json.loads(_PROCESSED_IDS_FILE.read_text(encoding="utf-8")))
        except Exception:
            return set()
    return set()


def _save_processed_ids(ids: set[str]) -> None:
    try:
        _PROCESSED_IDS_FILE.write_text(json.dumps(list(ids)), encoding="utf-8")
    except Exception as e:
        print(f"[gmail_service] Could not save processed IDs: {e}")


def fetch_unread_replies(max_results: int = 10) -> list[dict]:
    """
    Fetch unread and pending customer replies from the inbox.
    Tracks processed message IDs so even self-tested or read emails are processed once.

    Returns a list of dicts with:
    - message_id: Gmail ID
    - thread_id: Gmail thread ID
    - from_email: Extracted sender email
    - subject: Email subject line
    - body: Plain text content of the message
    """
    creds = _load_credentials()
    if creds is None:
        raise RuntimeError("Gmail not authenticated.")

    processed_ids = _load_processed_ids()

    try:
        service = _build_service(creds)
        # Query messages matching recovery reminders/invoices in INBOX from the last 2 days
        res = (
            service.users()
            .messages()
            .list(
                userId="me",
                q='label:INBOX subject:("Payment Reminder" OR "Invoice #") newer_than:2d',
                maxResults=25,
            )
            .execute()
        )

        seen_meta_ids = set()
        messages_meta = []
        for m in res.get("messages", []):
            mid = m["id"]
            if mid not in seen_meta_ids and mid not in processed_ids:
                seen_meta_ids.add(mid)
                messages_meta.append(m)

        if not messages_meta:
            return []

        results = []
        for meta in messages_meta:
            msg_id = meta["id"]
            msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
            labels = msg.get("labelIds", [])
            
            # Must be in INBOX
            if "INBOX" not in labels:
                processed_ids.add(msg_id)
                continue

            thread_id = msg.get("threadId")
            headers = msg.get("payload", {}).get("headers", [])
            
            from_header = next((h["value"] for h in headers if h["name"].lower() == "from"), "")
            to_header = next((h["value"] for h in headers if h["name"].lower() == "to"), "")
            subject_header = next((h["value"] for h in headers if h["name"].lower() == "subject"), "")

            # Extract clean emails
            from_match = re.search(r"<([^>]+)>", from_header)
            clean_email = from_match.group(1) if from_match else from_header.strip()

            to_match = re.search(r"<([^>]+)>", to_header)
            clean_to = to_match.group(1) if to_match else to_header.strip()

            # Must be a reply (starts with Re:)
            if not subject_header.strip().lower().startswith("re:"):
                processed_ids.add(msg_id)
                continue

            # If sent from authenticated account to a customer, it is outbound, not inbound
            if clean_email.lower() == "nishchalsundan04@gmail.com" and clean_to.lower() != "nishchalsundan04@gmail.com":
                processed_ids.add(msg_id)
                continue

            # Extract body
            body_text = ""
            payload = msg.get("payload", {})
            parts = payload.get("parts", [])
            if not parts and "data" in payload.get("body", {}):
                # Single part message
                data = payload["body"]["data"]
                body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            else:
                for part in parts:
                    if part.get("mimeType") == "text/plain" and "data" in part.get("body", {}):
                        data = part["body"]["data"]
                        body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                        break
                if not body_text and parts:
                    # fallback to first part
                    first_data = parts[0].get("body", {}).get("data")
                    if first_data:
                        body_text = base64.urlsafe_b64decode(first_data).decode("utf-8", errors="replace")

            # Mark as read so we don't process it again in next sync
            try:
                service.users().messages().modify(
                    userId="me",
                    id=msg_id,
                    body={"removeLabelIds": ["UNREAD"]},
                ).execute()
            except Exception as mod_err:
                print(f"[gmail_service] Could not remove UNREAD label from {msg_id}: {mod_err}")

            # Strip email reply history (quoted thread)
            clean_body = re.split(r"\r?\n\s*On\s+[\s\S]+?wrote:\s*", body_text, flags=re.IGNORECASE)[0]
            clean_body = re.split(r"\r?\n\s*-+\s*Original Message\s*-+", clean_body, flags=re.IGNORECASE)[0]
            clean_lines = [l for l in clean_body.splitlines() if not l.strip().startswith(">")]
            clean_body = "\n".join(clean_lines).strip()

            # Skip messages generated by the bot to prevent self-reply loops (only if from server account)
            if clean_email.lower() == "nishchalsundan04@gmail.com":
                BOT_SIGNATURES = [
                    "we have recorded your payment commitment",
                    "here are the details for invoice",
                    "thank you for confirming your payment",
                    "we could not locate a successful payment",
                    "we have escalated your request",
                    "recovery notice",
                    "payment reminder — invoice",
                    "payment reminder - invoice",
                ]
                if any(sig in clean_body.lower() for sig in BOT_SIGNATURES):
                    processed_ids.add(msg_id)
                    continue

            results.append({
                "message_id": msg_id,
                "thread_id": thread_id,
                "from_email": clean_email,
                "subject": subject_header,
                "body": clean_body if clean_body else body_text.strip(),
            })

        _save_processed_ids(processed_ids)
        return results
    except Exception as exc:
        print(f"[gmail_service] Error fetching unread replies: {exc}")
        return []


def mark_message_processed(msg_id: str) -> None:
    """Explicitly mark a message ID as processed so it is never re-processed."""
    if not msg_id:
        return
    ids = _load_processed_ids()
    ids.add(msg_id)
    _save_processed_ids(ids)

