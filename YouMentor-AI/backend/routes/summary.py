from flask import Blueprint, request, jsonify
from agents.summary_agent import generate_summary

summary_bp = Blueprint("summary", __name__)

@summary_bp.route("/summary", methods=["POST"])
def summary():

    data = request.get_json()

    video_url = data.get("url")

    if not video_url:
        return jsonify({
            "success": False,
            "message": "Video URL is required."
        }), 400

    try:

        result = generate_summary(video_url)

        return jsonify({
            "success": True,
            "summary": result
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500