import os
import json
import random
import logging
import requests
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


def generate_otp_code() -> str:
    """Generate a secure 6-digit numeric OTP."""
    return f"{random.randint(100000, 999999)}"


def _send_via_brevo(to_email: str, subject: str, html_message: str, text_message: str, api_key: str) -> dict:
    """
    Sends email via Brevo's HTTPS REST API (Port 443).
    Allows sending to ANY recipient email worldwide without domain verification.
    """
    try:
        sender_email = os.getenv("BREVO_SENDER_EMAIL", "").strip() or getattr(settings, "EMAIL_HOST_USER", "").strip() or "noreply@formcraft.io"
        sender_name = "FormCraft"

        clean_api_key = api_key.strip()

        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": clean_api_key,
                "Content-Type": "application/json",
                "accept": "application/json",
            },

            json={
                "sender": {"name": sender_name, "email": sender_email},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_message,
                "textContent": text_message,
            },
            timeout=10,
        )

        if response.status_code in [200, 201]:
            logger.info(f"Successfully delivered email to {to_email} via Brevo HTTPS API.")
            return {"success": True}
        else:
            err_data = response.json() if response.content else {"message": response.text}
            err_msg = err_data.get("message", response.text)
            logger.error(f"Brevo API error ({response.status_code}): {err_msg}")
            return {"success": False, "error": f"Brevo: {err_msg}"}
    except Exception as exc:
        logger.error(f"Brevo HTTP request exception: {exc}")
        return {"success": False, "error": str(exc)}


def _send_via_resend(to_email: str, subject: str, html_message: str, text_message: str, api_key: str) -> dict:
    """
    Sends email via Resend's HTTPS REST API (Port 443).
    Bypasses all cloud/host port blocks (e.g. Render Free tier SMTP blocking).
    """
    try:
        # Resend test keys permit 'onboarding@resend.dev' unless a custom domain is verified
        from_email = os.getenv("RESEND_FROM_EMAIL", "").strip() or "FormCraft <onboarding@resend.dev>"

        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_message,
                "text": text_message,
            },
            timeout=10,
        )

        if response.status_code in [200, 201]:
            logger.info(f"Successfully delivered email to {to_email} via Resend HTTPS API.")
            return {"success": True}
        else:
            err_data = response.json() if response.content else {"message": response.text}
            err_msg = err_data.get("message", response.text)
            logger.error(f"Resend API error ({response.status_code}): {err_msg}")
            return {"success": False, "error": f"Resend: {err_msg}"}
    except Exception as exc:
        logger.error(f"Resend HTTP request exception: {exc}")
        return {"success": False, "error": str(exc)}


def send_otp_email(to_email: str, otp_code: str, form_title: str) -> dict:
    """
    Sends an OTP verification email to the respondent.
    Supports Brevo (any recipient worldwide), Resend, and standard Django SMTP.
    """
    subject = f"Your Verification Code for {form_title}: {otp_code}"
    
    message_text = f"""
Hello,

Your verification code for filling out the form "{form_title}" is:

    {otp_code}

This code will expire in 10 minutes. Only one submission is permitted per email address.

If you did not request this code, please ignore this email.

Best regards,
The FormCraft Team
"""

    html_message = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .card {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .badge {{ display: inline-block; font-size: 12px; font-weight: 600; color: #059669; background: #ecfdf5; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px; }}
    .otp-box {{ background: #f1f5f9; border-radius: 12px; text-align: center; padding: 20px; margin: 24px 0; border: 1px dashed #cbd5e1; }}
    .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a; font-family: monospace; }}
    .footer {{ font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Verification Required</div>
    <h2 class="title">{form_title}</h2>
    <p style="font-size: 14px; line-height: 1.5; color: #475569;">
      Please enter the following one-time passcode to verify your email address and access the form.
    </p>
    <div class="otp-box">
      <div style="font-size: 12px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; font-weight: 600;">Your One-Time Code</div>
      <div class="otp-code">{otp_code}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Expires in 10 minutes</div>
    </div>
    <p style="font-size: 13px; color: #64748b;">
      Note: Each respondent can submit this form only once per verified email address.
    </p>
    <div class="footer">
      If you did not initiate this request, you can safely disregard this email.
    </div>
  </div>
</body>
</html>
"""

    # 1. Try Brevo HTTPS API first (Allows sending to ANY recipient email without domain verification)
    brevo_key = getattr(settings, "BREVO_API_KEY", os.getenv("BREVO_API_KEY", "")).strip()
    if brevo_key:
        brevo_result = _send_via_brevo(to_email, subject, html_message, message_text, brevo_key)
        if brevo_result.get("success"):
            return brevo_result
        raise RuntimeError(brevo_result.get("error", "Brevo API delivery failed."))

    # 2. Try Resend HTTPS API
    resend_key = getattr(settings, "RESEND_API_KEY", os.getenv("RESEND_API_KEY", "")).strip()
    if resend_key:
        resend_result = _send_via_resend(to_email, subject, html_message, message_text, resend_key)
        if resend_result.get("success"):
            return resend_result
        raise RuntimeError(resend_result.get("error", "Resend API delivery failed."))

    # 3. Try Standard Django SMTP
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "FormCraft <noreply@formcraft.io>")

    try:
        send_mail(
            subject=subject,
            message=message_text,
            from_email=from_email,
            recipient_list=[to_email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Successfully sent real-time OTP email to {to_email} for form '{form_title}' via SMTP.")
        return {"success": True}
    except Exception as exc:
        err_str = str(exc)
        logger.error(f"Failed to send email via SMTP ({err_str})")
        print(f"\n==========================================")
        print(f"📧 [FALLBACK SERVER LOG OTP] To: {to_email}")
        print(f"🔑 Form: {form_title}")
        print(f"👉 OTP CODE: {otp_code}")
        print(f"==========================================\n")

        if "[Errno 101]" in err_str or "Network is unreachable" in err_str:
            raise RuntimeError(
                "Render Free tier blocks outbound SMTP ports (587/465). "
                "Add a free BREVO_API_KEY or verified RESEND_API_KEY in Render Environment Variables to send emails to any recipient via HTTPS!"
            )
        raise exc


def send_submission_confirmation_email(to_email: str, form_title: str, submission_id: int, responses_summary: list = None) -> dict:
    """
    Sends a confirmation email to the respondent after they successfully submit a form,
    including a structured summary of their submitted answers.
    """
    if not to_email or "@" not in to_email:
        return {"success": False, "error": "Invalid email address"}

    submitted_at_str = timezone.now().strftime("%B %d, %Y at %I:%M %p UTC")
    subject = f"Submission Confirmed: {form_title} (ID #{submission_id})"

    # Format text summary
    summary_lines = []
    html_rows = []
    if responses_summary:
        for item in responses_summary:
            label = item.get("label", "Question")
            val = item.get("value", "")
            if isinstance(val, list):
                val_str = ", ".join(str(v) for v in val)
            elif isinstance(val, dict):
                val_str = val.get("name", json.dumps(val))
            else:
                val_str = str(val) if val is not None and val != "" else "N/A"

            summary_lines.append(f"• {label}: {val_str}")
            html_rows.append(f"""
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 12px; font-weight: 600; color: #475569; font-size: 13px; width: 40%; vertical-align: top;">
                  {label}
                </td>
                <td style="padding: 10px 12px; color: #0f172a; font-size: 13px; width: 60%;">
                  {val_str}
                </td>
              </tr>
            """)

    answers_text = "\n".join(summary_lines) if summary_lines else "No response summary available."
    answers_html = "".join(html_rows) if html_rows else "<tr><td colspan='2' style='padding: 12px; color: #64748b;'>No response data.</td></tr>"

    html_message = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .card {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .badge {{ display: inline-block; font-size: 12px; font-weight: 600; color: #059669; background: #ecfdf5; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px; border: 1px solid #a7f3d0; }}
    .title {{ font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px; }}
    .meta-box {{ background: #f8fafc; border-radius: 10px; padding: 12px 16px; margin: 16px 0; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; line-height: 1.6; }}
    .answers-table {{ width: 100%; border-collapse: collapse; margin-top: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }}
    .table-header {{ background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700; color: #334155; }}
    .footer {{ font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✓ Submission Confirmed</div>
    <h2 class="title">{form_title}</h2>
    <p style="font-size: 14px; line-height: 1.5; color: #475569; margin-top: 4px;">
      Thank you! Your response has been securely recorded. Here is a copy of your submission receipt.
    </p>

    <div class="meta-box">
      <div><strong>Submission ID:</strong> #{submission_id}</div>
      <div><strong>Submitted On:</strong> {submitted_at_str}</div>
      <div><strong>Verified Respondent:</strong> {to_email}</div>
    </div>

    <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 20px; margin-bottom: 8px;">
      Submitted Response Summary
    </h3>
    <table class="answers-table">
      <thead>
        <tr>
          <th class="table-header" style="width: 40%;">Field / Question</th>
          <th class="table-header" style="width: 60%;">Your Answer</th>
        </tr>
      </thead>
      <tbody>
        {answers_html}
      </tbody>
    </table>

    <div class="footer">
      Sent automatically by <strong>FormCraft</strong> • Dynamic Form Platform
    </div>
  </div>
</body>
</html>
"""

    message_text = f"""
Hello,

Your submission for "{form_title}" has been successfully received and recorded.

Submission Details:
- Submission ID: #{submission_id}
- Submitted On: {submitted_at_str}
- Respondent Email: {to_email}

Your Submitted Answers:
{answers_text}

Thank you for your submission.

Best regards,
The FormCraft Team
"""

    # 1. Try Brevo HTTPS API first
    brevo_key = getattr(settings, "BREVO_API_KEY", os.getenv("BREVO_API_KEY", "")).strip()
    if brevo_key:
        brevo_result = _send_via_brevo(to_email, subject, html_message, message_text, brevo_key)
        if brevo_result.get("success"):
            return brevo_result

    # 2. Try Resend HTTPS API
    resend_key = getattr(settings, "RESEND_API_KEY", os.getenv("RESEND_API_KEY", "")).strip()
    if resend_key:
        resend_result = _send_via_resend(to_email, subject, html_message, message_text, resend_key)
        if resend_result.get("success"):
            return resend_result

    # 3. Try Standard Django SMTP
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "FormCraft <noreply@formcraft.io>")
    try:
        send_mail(
            subject=subject,
            message=message_text,
            from_email=from_email,
            recipient_list=[to_email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Successfully sent submission confirmation email to {to_email} for submission #{submission_id}")
        return {"success": True}
    except Exception as exc:
        logger.error(f"Failed to send confirmation email to {to_email}: {exc}")
        return {"success": False, "error": str(exc)}
