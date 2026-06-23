import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
NOTIFY_TO = os.environ.get('NOTIFY_TO', '')   # comma-separated emails
APP_URL   = os.environ.get('APP_URL', 'http://localhost:5000')


def send_invite_email(to_email, username, invite_link):
    if not SMTP_USER or not SMTP_PASS:
        print(f'[email] Not configured — invite link: {invite_link}')
        return

    html = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;">
  <div style="background:#0d1b2a;padding:18px 24px;border-radius:8px 8px 0 0;">
    <div style="color:white;font-size:17px;font-weight:600;">IAMA BondDesk</div>
    <div style="color:rgba(255,255,255,0.55);font-size:11px;margin-top:2px;">Insurance Agency of Mid America</div>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 8px 8px;">
    <div style="font-size:22px;font-weight:700;color:#0d1b2a;margin-bottom:10px;">You're invited!</div>
    <div style="font-size:15px;color:#3c4043;margin-bottom:24px;line-height:1.6;">
      Hi <strong>{username}</strong>,<br><br>
      You've been added to <strong>IAMA BondDesk</strong>, the bond management system for Insurance Agency of Mid America.<br><br>
      Click the button below to set up your password and access your account.
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="{invite_link}" style="display:inline-block;background:#1565c0;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:600;">Set Up My Account</a>
    </div>
    <div style="background:#f8f9fa;border-radius:6px;padding:14px 16px;font-size:13px;color:#5f6368;">
      <strong style="color:#3c4043;">This link expires in 72 hours.</strong><br>
      If you didn't expect this email, you can ignore it. Contact your administrator if you have questions.
    </div>
    <div style="margin-top:20px;font-size:12px;color:#9aa0a6;border-top:1px solid #e8eaed;padding-top:16px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <span style="color:#1565c0;">{invite_link}</span>
    </div>
  </div>
</div>
"""

    msg = MIMEMultipart('alternative')
    msg['Subject'] = 'You\'ve been invited to IAMA BondDesk'
    msg['From']    = f'IAMA BondDesk <{SMTP_USER}>'
    msg['To']      = to_email
    msg.attach(MIMEText(html, 'html'))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, [to_email], msg.as_string())
        print(f'[email] Invite sent to {to_email}')
    except Exception as e:
        print(f'[email] Invite failed: {e}')
        raise
