
import os
import requests
from config import GNANI_API_KEY

GNANI_STT_URL = "https://api.vachana.ai/stt/v3"


def transcribe_audio(audio_path: str, language_code: str = "en-IN") -> str:
    """Transcribe a short audio file using Gnani Prisma STT."""

    if not GNANI_API_KEY:
        raise ValueError("GNANI_API_KEY is missing from backend/.env")

    if not os.path.isfile(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    headers = {
        "X-API-Key-ID": GNANI_API_KEY
    }

    with open(audio_path, "rb") as audio_file:
        files = {
            "audio_file": (
                os.path.basename(audio_path),
                audio_file
            )
        }

        data = {
            "language_code": language_code,
            "format": "transcribe"
        }

        response = requests.post(
            GNANI_STT_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=90
        )

    if not response.ok:
        print("GNANI STATUS:", response.status_code)
    print("GNANI RESPONSE:", response.text[:1000])
    print("GNANI KEY LOADED:", bool(GNANI_API_KEY))
    print("GNANI KEY LENGTH:", len(GNANI_API_KEY or ""))
    response.raise_for_status()
    result = response.json()

    if not result.get("success") or not result.get("transcript"):
        raise RuntimeError("Gnani could not transcribe the audio.")

    return result["transcript"]
