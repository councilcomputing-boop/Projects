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


def send_bond_notification(action, bond, changed_by, old_status=None):
    if not SMTP_USER or not SMTP_PASS or not NOTIFY_TO:
        return

    subjects = {
        'created':        f'New Bond Added — {bond.bond_number}',
        'updated':        f'Bond Updated — {bond.bond_number}',
        'status_changed': f'Bond Status Changed — {bond.bond_number}',
        'deleted':        f'Bond Deleted — {bond.bond_number}',
    }

    action_lines = {
        'created':        'A new bond has been added to the system.',
        'updated':        'A bond record has been updated.',
        'status_changed': f'Status changed from <strong>{old_status}</strong> to <strong>{bond.status}</strong>.',
        'deleted':        'A bond record has been removed from the system.',
    }

    status_color = {
        'Approved':     '#2e7d32',
        'Not Approved': '#c62828',
        'Pending':      '#e65100',
    }.get(bond.status, '#1565c0')

    amt_row = ''
    if bond.bond_amount:
        amt_row = f'<tr><td style="padding:5px 0;color:#5f6368;width:130px;">Amount</td><td style="padding:5px 0;color:#3c4043;">${bond.bond_amount:,.0f}</td></tr>'

    html = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;">
  <div style="background:#0d1b2a;padding:18px 24px;border-radius:8px 8px 0 0;">
    <div style="color:white;font-size:17px;font-weight:600;">IAMA BondDesk</div>
    <div style="color:rgba(255,255,255,0.55);font-size:11px;margin-top:2px;">Insurance Agency of Mid America</div>
  </div>
  <div style="background:white;padding:24px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 8px 8px;">
    <div style="font-size:15px;font-weight:600;color:#0d1b2a;margin-bottom:16px;">{action_lines.get(action,'')}</div>
    <div style="background:#f8f9fa;border-radius:6px;padding:18px;margin-bottom:18px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:5px 0;color:#5f6368;width:130px;">Bond Number</td><td style="padding:5px 0;font-weight:600;color:#0d1b2a;">{bond.bond_number}</td></tr>
        <tr><td style="padding:5px 0;color:#5f6368;">Bond Type</td><td style="padding:5px 0;color:#3c4043;">{bond.bond_type}</td></tr>
        <tr><td style="padding:5px 0;color:#5f6368;">Principal</td><td style="padding:5px 0;color:#3c4043;">{bond.principal}</td></tr>
        <tr><td style="padding:5px 0;color:#5f6368;">Obligee</td><td style="padding:5px 0;color:#3c4043;">{bond.obligee}</td></tr>
        <tr><td style="padding:5px 0;color:#5f6368;">Surety</td><td style="padding:5px 0;color:#3c4043;">{bond.surety}</td></tr>
        {amt_row}
        <tr><td style="padding:5px 0;color:#5f6368;">Status</td>
            <td style="padding:5px 0;">
              <span style="background:{status_color}22;color:{status_color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;">{bond.status}</span>
            </td></tr>
      </table>
    </div>
    <div style="font-size:13px;color:#5f6368;margin-bottom:18px;">Changed by: <strong style="color:#3c4043;">{changed_by}</strong></div>
    <a href="{APP_URL}" style="display:inline-block;background:#1565c0;color:white;padding:10px 22px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:500;">Open Bond Tracker</a>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e8eaed;font-size:11px;color:#9aa0a6;">
      This notification was sent automatically by Bond Tracker. Do not reply to this email.
    </div>
  </div>
</div>
"""

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subjects.get(action, 'Bond Tracker Notification')
    msg['From']    = f'Bond Tracker <{SMTP_USER}>'
    msg['To']      = NOTIFY_TO
    msg.attach(MIMEText(html, 'html'))

    recipients = [e.strip() for e in NOTIFY_TO.split(',') if e.strip()]

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, recipients, msg.as_string())
    except Exception as e:
        print(f'[email] Failed to send: {e}')


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
