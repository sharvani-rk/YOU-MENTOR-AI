"""Gnani Timbre v3 text-to-speech integration.

The audio configuration below uses WAV/linear PCM, matching the WAV response
format previously verified by the project owner (Base64 prefix UklGR...).
"""
import requests
from config import GNANI_API_KEY

TTS_URL = "https://api.vachana.ai/api/v1/tts/inference"

SUPPORTED = {
    "en": "en-IN",
    "english": "en-IN",
    "te": "te-IN",
    "telugu": "te-IN",
    "hi": "hi-IN",
    "hindi": "hi-IN",
    "ta": "ta-IN",
    "tamil": "ta-IN",
    "kn": "kn-IN",
    "kannada": "kn-IN",
    "ml": "ml-IN",
    "malayalam": "ml-IN",
    "mr": "mr-IN",
    "marathi": "mr-IN",
    "bn": "bn-IN",
    "bengali": "bn-IN",
    "gu": "gu-IN",
    "gujarati": "gu-IN",
    "pa": "pa-IN",
    "punjabi": "pa-IN",
    "hinglish": "hi-en",
    "tenglish": "auto",
    "benglish": "auto",
}

# These are provider voice identifiers, not verified demographic categories.
# Do not label them male/female/child/grandparent without provider metadata
# or listening tests. The extension can assign IDs automatically when the STT
# service supplies speaker_id / speakerId metadata.
VOICES = {
    "Shivani", "Avinash", "Lakshmi", "Kalpana", "Shubham", "Prakash",
    "Devansh", "Yashraj", "Chetana", "Vasudha", "Riyaa", "Tarika", "Harshad"
}


def synthesize_speech(text: str, language: str, voice: str = "Shivani") -> bytes:
    if not GNANI_API_KEY:
        raise ValueError("GNANI_API_KEY is missing from backend/.env")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text is required for speech generation.")

    language_key = str(language or "").strip().lower()
    if language_key not in SUPPORTED:
        raise ValueError(f"Unsupported TTS language: {language}")

    if voice not in VOICES:
        raise ValueError("Unsupported Timbre voice identifier.")

    payload = {
        "text": text.strip(),
        "voice": voice,
        "model": "timbre-v3.0",
        "language": SUPPORTED[language_key],
        "speed": 1.0,
        "audio_config": {
            "sample_rate": 48000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav"
        }
    }

    response = requests.post(
        TTS_URL,
        headers={
            "X-API-Key-ID": GNANI_API_KEY,
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=60
    )

    if not response.ok:
        try:
            body = response.json()
            detail = (
                body.get("message")
                or (body.get("detail") or {}).get("message")
                or str(body)
            )
        except Exception:
            detail = response.text[:300]
        raise RuntimeError(f"Gnani TTS error ({response.status_code}): {detail}")

    audio = response.content
    if not audio:
        raise RuntimeError("Gnani TTS returned an empty audio response.")

    # WAV files normally begin with RIFF....WAVE.
    if not (audio[:4] == b"RIFF" and audio[8:12] == b"WAVE"):
        raise RuntimeError(
            "Gnani TTS response was not WAV audio. Check the provider's audio_config response format."
        )

    return audio