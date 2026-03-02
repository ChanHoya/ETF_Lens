import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from dotenv import load_dotenv
import logging

load_dotenv(override=True)
logger = logging.getLogger(__name__)

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")


def send_morning_briefing_email(
    target_email: str, html_body: str, images_cid_map: dict = None
):
    """
    Send an HTML email with optionally inline embedded images.
    images_cid_map argument should be a dict like: {'chart1': '/path/to/chart1.png'}
    where 'chart1' matches <img src="cid:chart1"> in the html_body.
    """
    if not SMTP_USER or not SMTP_PASS:
        logger.error(
            "SMTP_USER or SMTP_PASS not set in environment. Cannot send email."
        )
        return False

    msg = MIMEMultipart("related")
    msg["Subject"] = "📊 일일 코스피 출구 전략 & 모닝 브리핑 리포트"
    msg["From"] = SMTP_USER
    msg["To"] = target_email

    msg_alternative = MIMEMultipart("alternative")
    msg.attach(msg_alternative)

    # Attach HTML
    msg_html = MIMEText(html_body, "html")
    msg_alternative.attach(msg_html)

    # Attach embedded inline images
    if images_cid_map:
        for cid, image_path in images_cid_map.items():
            try:
                with open(image_path, "rb") as f:
                    img_data = f.read()
                    img = MIMEImage(img_data)
                    img.add_header("Content-ID", f"<{cid}>")
                    img.add_header(
                        "Content-Disposition",
                        "inline",
                        filename=os.path.basename(image_path),
                    )
                    msg.attach(img)
            except Exception as e:
                logger.error(f"Failed to attach image {image_path}: {e}")

    try:
        # TLS Connection
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, target_email, msg.as_string())
        server.quit()
        logger.info(f"Morning briefing successfully sent to {target_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {target_email}: {e}")
        return False
