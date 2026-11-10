def build_flashcard_prompt(transcript: str) -> str:

    return f"""

You are an educational flashcard generator.

Create useful study flashcards based ONLY on the following
YouTube transcript.

Focus on:
- Important concepts
- Important vocabulary
- Key facts
- Definitions
- Cause and effect relationships
- Information that a student should remember

IMPORTANT:

Return ONLY valid JSON.

Do not wrap the JSON inside markdown.

Do not use ```json.

Do not add explanations before or after the JSON.

Use this exact structure:

{{
    "title": "Study Flashcards",
    "cards": [
        {{
            "front": "",
            "back": "",
            "difficulty": "easy"
        }},
        {{
            "front": "",
            "back": "",
            "difficulty": "medium"
        }},
        {{
            "front": "",
            "back": "",
            "difficulty": "hard"
        }},
        {{
            "front": "",
            "back": "",
            "difficulty": "medium"
        }},
        {{
            "front": "",
            "back": "",
            "difficulty": "hard"
        }},
        {{
            "front": "",
            "back": "",
            "difficulty": "easy"
        }},
        {{
            "front": "",
            "back": "",
            "difficulty": "medium"
        }},
        {{
            "front": "",
            "back": "",
            "difficulty": "hard"
        }}
    ]
}}

Rules:

- Generate exactly 8 flashcards.
- Each card must have a clear question or prompt on the front.
- The back must contain the correct answer or explanation.
- Cards should test understanding and memory.
- Include a mixture of easy, medium, and hard cards.
- Avoid trivial or insignificant information.
- Do not repeat the same concept.
- Do not invent information.
- Use ONLY information supported by the transcript.
- Keep the front concise.
- Keep the back clear and useful for revision.
- Return valid JSON only.

Transcript:

{transcript}

"""