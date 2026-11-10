from flask import Blueprint, request, jsonify
from agents.explanation_agent import generate_explanation


explanation_bp = Blueprint("explanation", __name__)


@explanation_bp.route("/explain", methods=["POST"])
def explanation():

    data = request.get_json()

    video_url = data.get("url")

    if not video_url:
        return jsonify({
            "success": False,
            "message": "Video URL is required."
        }), 400

    try:

        result = generate_explanation(video_url)

        return jsonify({
            "success": True,
            "explanation": result
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500