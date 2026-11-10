from agents.transcript_agent import get_transcript
from prompts.explanation_prompt import build_explanation_prompt
from services.groq_service import ask_groq
import json


def generate_explanation(video_url: str):

    transcript = get_transcript(video_url)

    prompt = build_explanation_prompt(transcript)

    explanation = ask_groq(prompt)

    return json.loads(explanation)


if __name__ == "__main__":

    url = input("Enter YouTube URL: ")

    result = generate_explanation(url)

    print(result)