"""Send contact-form messages by email (stdlib smtplib, no extra dependencies).

Configure with environment variables (on the VPS: /etc/portfolio.env):

    SMTP_HOST      e.g. smtp.gmail.com
    SMTP_PORT      587 (STARTTLS, default) or 465 (SSL)
    SMTP_USER      the account you send from, e.g. you@gmail.com
    SMTP_PASSWORD  for Gmail: an App Password (Google account > Security >
                   2-Step Verification > App passwords), NOT your normal password
    CONTACT_TO     where messages land (defaults to SMTP_USER)

If SMTP_HOST is unset (e.g. local development), messages are only printed to
the server log.
"""
from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr


def configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))


def _oneline(s: str, limit: int = 120) -> str:
    """Strip line breaks (header-injection safe) and cap length."""
    return " ".join(s.split())[:limit]


def send_contact(name: str, email: str, message: str, ip: str = "") -> None:
    """Email a contact-form submission. Raises on failure."""
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASSWORD"]
    to = os.environ.get("CONTACT_TO") or user

    msg = EmailMessage()
    msg["Subject"] = f"Portfolio contact — {_oneline(name, 60)}"
    msg["From"] = formataddr(("Portfolio contact form", user))   # must be your own address
    msg["To"] = to
    msg["Reply-To"] = formataddr((_oneline(name, 60), _oneline(email, 200)))  # hit Reply to answer them
    msg.set_content(
        f"From:  {_oneline(name)} <{_oneline(email, 200)}>\n"
        f"IP:    {ip or 'unknown'}\n"
        f"\n{message}\n"
    )

    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as s:
            s.login(user, password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.starttls(context=ctx)
            s.login(user, password)
            s.send_message(msg)
