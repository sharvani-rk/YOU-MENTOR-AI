from flask import Blueprint, request, jsonify
from agents.vocabulary_agent import generate_vocabulary


vocabulary_bp = Blueprint("vocabulary", __name__)


@vocabulary_bp.route("/vocabulary", methods=["POST"])
def vocabulary():

    data = request.get_json()

    video_url = data.get("url")

    if not video_url:
        return jsonify({
            "success": False,
            "message": "Video URL is required."
        }), 400

    try:

        result = generate_vocabulary(video_url)

        return jsonify({
            "success": True,
            "vocabulary": result
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500