
"""Live translation and YouTube caption endpoints."""

import base64
import traceback

from flask import Blueprint, request, jsonify

from services.translation_service import translate_text
from services.gnani_tts_service import synthesize_speech

live_translation_bp = Blueprint("live_translation", __name__)

SUPPORTED_LANGUAGES = (
    "en", "te", "hi", "ta", "kn",
    "ml", "mr", "bn", "gu", "pa",
    "hinglish", "tenglish", "benglish"
)


def normalize_language(language):
    """Normalize language codes used by the TTS service."""
    language = str(language or "en").lower().replace("-in", "")

    if language not in SUPPORTED_LANGUAGES:
        return "en"

    return language


# ---------------------------------------------------------
# 1. EXISTING GNANI LIVE SEGMENT PROCESSING
# ---------------------------------------------------------

@live_translation_bp.post("/process-live-segment")
def process_live_segment():
    """Process a completed STT segment from the existing live pipeline."""

    data = request.get_json(silent=True) or {}

    text = (data.get("text") or "").strip()
    subtitle_language = data.get("subtitle_language", "original")
    audio_language = data.get("audio_language", "none")
    voice = data.get("voice", "Shivani")

    if not text:
        return jsonify({
            "success": False,
            "message": "Transcript segment is empty."
        }), 400

    try:
        # Process subtitles.
        subtitle_text = text

        if subtitle_language not in ("none", "original"):
            subtitle_text = translate_text(text, subtitle_language)

        elif subtitle_language == "none":
            subtitle_text = ""

        # Process AI voice.
        audio_base64 = None
        audio_mime = None

        if audio_language != "none":

            if audio_language == "original":
                audio_text = text
                tts_language = data.get("detected_language", "en")
            else:
                audio_text = translate_text(text, audio_language)
                tts_language = audio_language

            tts_language = normalize_language(tts_language)

            audio = synthesize_speech(
                audio_text,
                tts_language,
                voice
            )

            audio_base64 = base64.b64encode(audio).decode("ascii")
            audio_mime = "audio/mpeg"

        return jsonify({
            "success": True,
            "subtitle_text": subtitle_text,
            "audio_base64": audio_base64,
            "audio_mime": audio_mime
        })

    except Exception as exc:
        print("PROCESS LIVE SEGMENT ERROR:", repr(exc))
        traceback.print_exc()

        return jsonify({
            "success": False,
            "message": str(exc)
        }), 500


# ---------------------------------------------------------
# 2. EXISTING LIVE SUBTITLE TRANSLATION
# ---------------------------------------------------------


@live_translation_bp.post("/translate-live-segment")
def translate_live_segment():

    data = request.get_json(silent=True) or {}

    text = (data.get("text") or "").strip()
    target = data.get("subtitle_language", "original")
    source = data.get("source_language", "auto")

    if not text:
        return jsonify({
            "success": False,
            "message": "Transcript segment is empty."
        }), 400

    try:
        source_base = str(source).lower().split("-")[0]
        target_base = str(target).lower().split("-")[0]

        if target in ("original", "none"):
            translated = text

        elif source_base == target_base:
            translated = text

        else:
            translated = translate_text(text, target)

        return jsonify({
            "success": True,
            "translated_text": (
                "" if target == "none" else translated
            )
        })

    except Exception as exc:
        print("LIVE TRANSLATION ERROR:", repr(exc))
        traceback.print_exc()

        return jsonify({
            "success": False,
            "message": str(exc)
        }), 500

# ---------------------------------------------------------
# 3. EXISTING LIVE VOICE SYNTHESIS
# ---------------------------------------------------------


@live_translation_bp.post("/synthesize-live-segment")
def synthesize_live_segment():

    data = request.get_json(silent=True) or {}

    text = (data.get("text") or "").strip()
    requested_language = data.get("audio_language", "none")
    voice = data.get("voice", "Shivani")

    detected = normalize_language(
        data.get("detected_language", "en")
    )

    if not text or requested_language == "none":
        return jsonify({
            "success": False,
            "message": "Text and an audio language are required."
        }), 400

    try:
        if requested_language == "original":
            language = detected
            spoken_text = text
        else:
            language = normalize_language(requested_language)
            spoken_text = translate_text(text, language)

        if not spoken_text:
            raise ValueError("Translation returned empty text.")

        audio = synthesize_speech(
            spoken_text,
            language,
            voice
        )

        return jsonify({
            "success": True,
            "translated_text": spoken_text,
            "audio_base64": base64.b64encode(audio).decode("ascii"),
            "audio_mime": "audio/wav"
        })

    except Exception as exc:
        print("LIVE VOICE SYNTHESIS ERROR:", repr(exc))
        traceback.print_exc()

        return jsonify({
            "success": False,
            "message": str(exc)
        }), 500



# ---------------------------------------------------------
# 4. NEW: FETCH ORIGINAL YOUTUBE CAPTIONS
# ---------------------------------------------------------


@live_translation_bp.post("/youtube-captions")
def get_youtube_captions():
    """Fetch original YouTube captions with timestamps, without Gnani STT."""

    data = request.get_json(silent=True) or {}
    video_id = (data.get("video_id") or "").strip()

    if not video_id:
        return jsonify({
            "success": False,
            "message": "YouTube video ID is required."
        }), 400

    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        api = YouTubeTranscriptApi()

        # Discover all available caption tracks.
        transcript_list = api.list(video_id)

        available = list(transcript_list)

        if not available:
            return jsonify({
                "success": False,
                "message": "No captions are available for this video."
            }), 404

        # Prefer manually created captions, then auto-generated captions.
        selected = next(
            (item for item in available if not item.is_generated),
            available[0]
        )

        transcript = selected.fetch()

        captions = []

        for item in transcript:
            text = str(item.text).strip()

            if text:
                captions.append({
                    "start": float(item.start),
                    "duration": float(item.duration),
                    "text": text
                })

        if not captions:
            return jsonify({
                "success": False,
                "message": "The selected caption track is empty."
            }), 404

        return jsonify({
            "success": True,
            "video_id": video_id,
            "caption_language": selected.language_code,
            "caption_language_name": selected.language,
            "is_generated": selected.is_generated,
            "captions": captions
        })

    except Exception as exc:
        print("YOUTUBE CAPTION ERROR:", repr(exc))
        traceback.print_exc()

        return jsonify({
            "success": False,
            "message": (
                "Could not retrieve YouTube captions. "
                "The video may not have accessible captions."
            )
        }), 500
