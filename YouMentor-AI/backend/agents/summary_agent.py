
from agents.transcript_agent import get_transcript
from prompts.summary_prompt import build_summary_prompt
from services.groq_service import ask_groq
from services.gnani_service import transcribe_audio
import json


def generate_summary(video_url: str):
    """Generate a summary from an accessible YouTube transcript."""

    transcript = get_transcript(video_url)
    return generate_summary_from_text(transcript)


def generate_summary_from_text(transcript: str):
    """Generate a structured summary from any transcript text."""

    if not transcript or not transcript.strip():
        raise ValueError("Transcript text cannot be empty.")

    prompt = build_summary_prompt(transcript)
    summary = ask_groq(prompt)

    return json.loads(summary)


def generate_audio_summary(audio_path: str, language_code: str = "en-IN"):
    """Transcribe an audio file with Gnani, then summarize it with Groq."""

    transcript = transcribe_audio(audio_path, language_code)
    summary = generate_summary_from_text(transcript)

    return {
        "transcript": transcript,
        "summary": summary
    }


if __name__ == "__main__":
    url = input("Enter YouTube URL: ")
    result = generate_summary(url)
    print(result)
