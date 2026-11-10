def build_vocabulary_prompt(transcript: str) -> str:

    return f"""

You are an educational vocabulary assistant.

Analyze the following YouTube transcript and identify the most
important and useful vocabulary terms for a student learning the topic.

Focus on:
- Technical terms
- Difficult terms
- Subject-specific terminology
- Important concepts
- Words whose meaning is important for understanding the video

IMPORTANT:

Return ONLY valid JSON.

Do not wrap the JSON inside markdown.

Do not use ```json.

Do not add explanations before or after the JSON.

Use this exact structure:

{{
    "title": "Important Vocabulary",
    "words": [
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "easy"
        }},
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "medium"
        }},
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "hard"
        }},
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "medium"
        }},
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "hard"
        }},
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "easy"
        }},
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "medium"
        }},
        {{
            "term": "",
            "simple_meaning": "",
            "contextual_meaning": "",
            "example": "",
            "difficulty": "hard"
        }}
    ]
}}

Rules:

- Generate exactly 8 vocabulary terms.
- Select terms that are genuinely useful for understanding the video.
- Do not select random or insignificant words.
- Prefer technical and subject-specific terminology.
- simple_meaning must be easy enough for a beginner to understand.
- contextual_meaning must explain how the term is used in the video.
- example must provide a clear example related to the topic.
- Difficulty must be one of:
  "easy", "medium", or "hard".
- Do not invent terminology that is unrelated to the transcript.
- Base the vocabulary ONLY on the transcript.
- Avoid duplicate terms.
- Return valid JSON only.

Transcript:

{transcript}

"""