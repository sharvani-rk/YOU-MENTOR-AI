
from flask import Blueprint, request, jsonify
from agents.summary_agent import generate_summary_from_text
from services.gnani_service import transcribe_audio
from werkzeug.utils import secure_filename
import logging
import os
import tempfile

audio_bp = Blueprint("audio", __name__)

ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"
}

SUPPORTED_LANGUAGES = {
    "bn-IN": "Bengali",
    "en-IN": "English (India)",
    "gu-IN": "Gujarati",
    "hi-IN": "Hindi",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "mr-IN": "Marathi",
    "pa-IN": "Punjabi",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
}


@audio_bp.route("/transcribe-audio", methods=["POST"])
def transcribe_audio_route():
    if "audio" not in request.files:
        return jsonify({
            "success": False,
            "message": "Upload an audio file using the 'audio' field."
        }), 400

    audio = request.files["audio"]

    if not audio.filename:
        return jsonify({
            "success": False,
            "message": "No file selected."
        }), 400

    filename = secure_filename(audio.filename)
    extension = os.path.splitext(filename)[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({
            "success": False,
            "message": "Unsupported audio format."
        }), 400

    # Default to English when no language is provided.
    requested_language = request.form.get(
        "language_code", "en-IN"
    ).strip() or "en-IN"

    if requested_language not in SUPPORTED_LANGUAGES:
        return jsonify({
            "success": False,
            "message": "Unsupported language code.",
            "supported_languages": SUPPORTED_LANGUAGES
        }), 400

    language_code = requested_language
    language_name = SUPPORTED_LANGUAGES[language_code]

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:
            temp_path = temp_file.name

        audio.save(temp_path)

        transcript = transcribe_audio(
            temp_path,
            language_code
        )

        summary = generate_summary_from_text(transcript)

        return jsonify({
            "success": True,
            "language_code": language_code,
            "language": language_name,
            "transcript": transcript,
            "summary": summary
        }), 200

    except Exception:
        logging.exception(
            "Audio transcription or summarization failed"
        )
        return jsonify({
            "success": False,
            "message": (
                "Audio processing failed. "
                "Check the backend terminal for details."
            )
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                logging.exception(
                    "Could not remove temporary audio file"
                )
