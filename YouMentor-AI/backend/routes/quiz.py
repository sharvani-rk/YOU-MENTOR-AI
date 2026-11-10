from flask import Blueprint, request, jsonify
from agents.quiz_agent import generate_quiz


quiz_bp = Blueprint("quiz", __name__)


@quiz_bp.route("/quiz", methods=["POST"])
def quiz():

    data = request.get_json()

    video_url = data.get("url")

    if not video_url:
        return jsonify({
            "success": False,
            "message": "Video URL is required."
        }), 400

    try:

        result = generate_quiz(video_url)

        return jsonify({
            "success": True,
            "quiz": result
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500