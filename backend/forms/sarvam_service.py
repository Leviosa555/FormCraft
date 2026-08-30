import logging
import os
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate"

LANGUAGE_CODE_MAP = {
    "en": "en-IN",
    "hi": "hi-IN",
    "kn": "kn-IN",
}

def get_sarvam_api_key() -> str:
    """
    Retrieve Sarvam API Key from Django settings or environment variables.
    """
    return getattr(settings, "SARVAM_API_KEY", "") or os.getenv("SARVAM_API_KEY", "")

def translate_text_with_sarvam(text: str, target_lang: str = "hi", source_lang: str = "en") -> str:
    """
    Translate text using Sarvam AI Indic Translation API (supports Hindi & Kannada).
    Falls back gracefully if API key is not configured or network error occurs.
    """
    if not text or not text.strip():
        return text

    api_key = get_sarvam_api_key()
    if not api_key:
        logger.info("SARVAM_API_KEY not configured. Returning original text.")
        return text

    target_code = LANGUAGE_CODE_MAP.get(target_lang, "hi-IN")
    source_code = LANGUAGE_CODE_MAP.get(source_lang, "en-IN")

    if target_code == source_code:
        return text

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }

    payload = {
        "input": text.strip(),
        "source_language_code": source_code,
        "target_language_code": target_code,
        "speaker_gender": "Female",
        "mode": "formal",
        "model": "mayura:v1",
    }

    try:
        response = requests.post(SARVAM_TRANSLATE_URL, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("translated_text", text)
        else:
            logger.warning("Sarvam AI translation error %s: %s", response.status_code, response.text)
            return text
    except Exception as exc:
        logger.error("Failed to connect to Sarvam AI translation API: %s", exc)
        return text
