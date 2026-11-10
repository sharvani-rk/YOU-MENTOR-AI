from agents.transcript_agent import get_transcript
from prompts.flashcard_prompt import build_flashcard_prompt
from services.groq_service import ask_groq
import json


def generate_flashcards(video_url: str):

    transcript = get_transcript(video_url)

    prompt = build_flashcard_prompt(transcript)

    flashcards = ask_groq(prompt)

    return json.loads(flashcards)


if __name__ == "__main__":

    url = input("Enter YouTube URL: ")

    result = generate_flashcards(url)

    print(result)