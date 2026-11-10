from flask import Flask
from flask_cors import CORS

from routes.summary import summary_bp

app = Flask(__name__)

CORS(app)

app.register_blueprint(summary_bp)


@app.route("/")
def home():
    return {
        "message": "YouMentor AI Backend Running 🚀"
    }


if __name__ == "__main__":
    app.run(debug=True)