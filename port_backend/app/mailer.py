"""Send contact-form messages by email (stdlib only, no extra dependencies).

Preferred: Resend's HTTPS API (works on hosts that block outgoing SMTP, like
new DigitalOcean droplets). Set in /etc/portfolio.env:

    RESEND_API_KEY  from resend.com > API Keys (starts with re_)
    CONTACT_TO      where messages land - on the free plan without a verified
                    domain this must be the address you signed up to Resend with

Fallback: plain SMTP, with these variables:

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

import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr


def _resend() -> bool:
    return bool(os.environ.get("RESEND_API_KEY") and os.environ.get("CONTACT_TO"))


def configured() -> bool:
    return _resend() or bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))


def _oneline(s: str, limit: int = 120) -> str:
    """Strip line breaks (header-injection safe) and cap length."""
    return " ".join(s.split())[:limit]


def _send_resend(name: str, email: str, message: str, ip: str) -> None:
    payload = {
        "from": "Portfolio contact form <onboarding@resend.dev>",  # Resend's shared sender, no domain needed
        "to": [os.environ["CONTACT_TO"]],
        "reply_to": f"{_oneline(name, 60)} <{_oneline(email, 200)}>",  # hit Reply to answer them
        "subject": f"Portfolio contact - {_oneline(name, 60)}",
        "text": f"From:  {_oneline(name)} <{_oneline(email, 200)}>\nIP:    {ip or 'unknown'}\n\n{message}\n",
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}", "Content-Type": "application/json",
                 "User-Agent": "portfolio-contact/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read()
    except urllib.error.HTTPError as e:  # surface Resend's reason (bad key, recipient not allowed...)
        raise RuntimeError(f"Resend {e.code}: {e.read().decode(errors='replace')[:300]}") from None


def send_contact(name: str, email: str, message: str, ip: str = "") -> None:
    """Email a contact-form submission. Raises on failure."""
    if _resend():
        _send_resend(name, email, message, ip)
        return
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
