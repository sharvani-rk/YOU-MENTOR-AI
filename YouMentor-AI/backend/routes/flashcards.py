from flask import Blueprint, request, jsonify
from agents.flashcard_agent import generate_flashcards


flashcards_bp = Blueprint("flashcards", __name__)


@flashcards_bp.route("/flashcards", methods=["POST"])
def flashcards():

    data = request.get_json()

    video_url = data.get("url")

    if not video_url:
        return jsonify({
            "success": False,
            "message": "Video URL is required."
        }), 400

    try:

        result = generate_flashcards(video_url)

        return jsonify({
            "success": True,
            "flashcards": result
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500