def build_explanation_prompt(transcript: str) -> str:

    return f"""

You are an educational AI assistant.

Analyze the following YouTube transcript and explain the important
concepts in a simple, clear, and student-friendly way.

IMPORTANT:

Return ONLY valid JSON.

Do not wrap the JSON inside markdown.

Do not use ```json.

Do not add explanations before or after the JSON.

Use this exact structure:

{{
    "overview": "",
    "concepts": [
        {{
            "term": "",
            "explanation": "",
            "example": ""
        }},
        {{
            "term": "",
            "explanation": "",
            "example": ""
        }},
        {{
            "term": "",
            "explanation": "",
            "example": ""
        }}
    ],
    "simple_explanation": "",
    "key_takeaway": ""
}}

Rules:

- Identify the most important concepts from the transcript.
- Explain each concept in simple language.
- Use examples when they help understanding.
- Avoid unnecessary technical complexity.
- Do not introduce information that is unrelated to the transcript.
- Make the explanation useful for a student who is learning the topic
  for the first time.

Transcript:

{transcript}

"""