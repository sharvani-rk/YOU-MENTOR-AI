from agents.transcript_agent import get_transcript
from prompts.quiz_prompt import build_quiz_prompt
from services.groq_service import ask_groq
import json


def generate_quiz(video_url: str):

    transcript = get_transcript(video_url)

    prompt = build_quiz_prompt(transcript)

    quiz = ask_groq(prompt)

    return json.loads(quiz)


if __name__ == "__main__":

    url = input("Enter YouTube URL: ")

    result = generate_quiz(url)

    print(result)