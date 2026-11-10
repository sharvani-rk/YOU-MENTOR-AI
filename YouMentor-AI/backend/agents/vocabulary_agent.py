from agents.transcript_agent import get_transcript
from prompts.vocabulary_prompt import build_vocabulary_prompt
from services.groq_service import ask_groq
import json


def generate_vocabulary(video_url: str):

    transcript = get_transcript(video_url)

    prompt = build_vocabulary_prompt(transcript)

    vocabulary = ask_groq(prompt)

    return json.loads(vocabulary)


if __name__ == "__main__":

    url = input("Enter YouTube URL: ")

    result = generate_vocabulary(url)

    print(result)