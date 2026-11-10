import os
from pathlib import Path
from dotenv import load_dotenv

# Always load the .env file located inside the backend folder
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=True)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "openai/gpt-oss-120b")
GNANI_API_KEY = (os.getenv("GNANI_API_KEY") or "").strip()