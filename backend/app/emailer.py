import os
import smtplib
import ssl
from email.message import EmailMessage
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

log = logging.getLogger(__name__)

# generic config
ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"
BACKEND = os.getenv("EMAIL_BACKEND", "smtp").lower()  # only smtp supported; while be ses in prod
FROM_EMAIL = os.getenv("EMAIL_FROM")
REPLY_TO = os.getenv("EMAIL_REPLY_TO") or FROM_EMAIL
PUBLIC_ORIGIN = os.getenv("PUBLIC_ORIGIN", "http://localhost:8080")

# SMTP config
SMTP_HOST = os.getenv("EMAIL_SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("EMAIL_SMTP_PORT", "25"))
SMTP_USERNAME = os.getenv("EMAIL_SMTP_USER", "")
SMTP_PASSWORD = os.getenv("EMAIL_SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("EMAIL_SMTP_USE_TLS", "false").lower() == "true"

# SES config
SES_REGION = os.getenv("EMAIL_SES_REGION", "eu-central-1")

# lazy SES client
_ses_client = None

def _get_ses():
    global _ses_client
    if _ses_client is None:
        import boto3
        from botocore.config import Config
        _ses_client = boto3.client(
            "sesv2",
            region_name=SES_REGION,
            config=Config(retries={"max_attempts": 3, "mode": "standard"}),
        )
    return _ses_client

def _build_share_email(
    to_email: str,
    recipient_name: Optional[str],
    doc_title: str,
    invited_by: str,
    doc_id: Optional[int],
) -> tuple[str, str, str]:
    
    subject = f"{invited_by} shared a document with you"
    greet_name = recipient_name or "there"

    # link to doc if we have doc_id, else to homepage
    doc_url = f"{PUBLIC_ORIGIN}/docs/{doc_id}" if doc_id else f"{PUBLIC_ORIGIN}/"


    html = f"""
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
        <h2 style="margin:0 0 .5rem">Yei, you've been invited to another doc!</h2>
        <p>Hi {greet_name}, </p>
        <p style="margin:.25rem 0 1rem">
          <strong>{invited_by}</strong> shared a document with you:
        </p>
        <p style="font-size:16px;margin:.25rem 0 1rem"><em>{doc_title or 'Untitled'}</em></p>
        <p>
          <a href="{doc_url}/" 
             style="background:#4f46e5;color:#fff;padding:.6rem 1rem;border-radius:8px;text-decoration:none;display:inline-block">
             Open document
          </a>
        </p>
        <p> Hush, hush, open it and start collaborating!</p>
        <p style="color:#64748b;font-size:12px;margin-top:1rem">
           Oh, btw: If you weren't expecting this, you can just ignore it :>.
        </p>
      </div>
    """
    text = (
        f"Hi {greet_name},\n"
        f"{invited_by} shared a document with you: {(doc_title or 'Untitled')}\n"
        f"Hush, hush, open it and start collaborating!\n"
        f"Open: {doc_url}\n"
        f"If you weren't expecting this, you can ignore it.\n"
    )    
    return subject, html, text


def _send_smtp(to_email: str, subject: str, html: str, text: str) -> bool:
    msg = EmailMessage()
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    if REPLY_TO:
        msg["Reply-To"] = REPLY_TO

    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        if SMTP_USE_TLS:
            context = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls(context=context)
                if SMTP_USERNAME:
                    s.login(SMTP_USERNAME, SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                if SMTP_USERNAME:
                    s.login(SMTP_USERNAME, SMTP_PASSWORD)
                s.send_message(msg)
        log.info("SMTP: sent to %s", to_email)
        return True
    except Exception as e:
        log.exception("SMTP send failed: %s", e)
        return False

def _send_ses(to_email: str, subject: str, html: str, text: str) -> bool:
    try:
        _get_ses().send_email(
            FromEmailAddress=FROM_EMAIL,
            Destination={"ToAddresses": [to_email]},
            ReplyToAddresses=[REPLY_TO] if REPLY_TO else [],
            Content={"Simple": {"Subject": {"Data": subject},
                                "Body": {"Text": {"Data": text},
                                         "Html": {"Data": html}}}},
        )
        log.info("SES: sent to %s", to_email)
        return True
    except Exception as e:
        log.exception("SES send failed: %s", e)
        return False

def send_share_email(
    to_email: str,
    doc_title: str,
    invited_by: str,
    *,
    recipient_name: Optional[str] = None,
    doc_id: Optional[int] = None,
) -> bool:
    if not ENABLED or not FROM_EMAIL or not to_email:
        log.info("Email disabled or missing FROM/recipient; skip. to=%s", to_email)
        return False

    subject, html, text = _build_share_email(
        to_email=to_email,
        recipient_name=recipient_name,
        doc_title=doc_title,
        invited_by=invited_by,
        doc_id=doc_id,
    )

    if BACKEND == "ses":
        return _send_ses(to_email, subject, html, text)
    return _send_smtp(to_email, subject, html, text)


_executor = ThreadPoolExecutor(max_workers=2)
def send_share_email_bg(
    to_email: str,
    doc_title: str,
    invited_by: str,
    *,
    recipient_name: Optional[str] = None,
    doc_id: Optional[int] = None,
) -> None:
    """Background version of send_share_email(). Returns immediately."""
    _executor.submit(
        send_share_email,
        to_email,
        doc_title,
        invited_by,
        recipient_name=recipient_name,
        doc_id=doc_id,
    )