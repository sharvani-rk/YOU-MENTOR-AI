def build_quiz_prompt(transcript: str) -> str:

    return f"""

You are an educational AI quiz generator.

Create a quiz based ONLY on the following YouTube transcript.

The quiz should test whether a student actually understands
the important information presented in the video.

IMPORTANT:

Return ONLY valid JSON.

Do not wrap the JSON inside markdown.

Do not use ```json.

Do not add explanations before or after the JSON.

Use this exact structure:

{{
    "title": "Video Quiz",
    "instructions": "Choose the best answer for each question.",
    "questions": [
        {{
            "question": "",
            "options": [
                "",
                "",
                "",
                ""
            ],
            "correct_answer": "",
            "explanation": "",
            "difficulty": "easy"
        }},
        {{
            "question": "",
            "options": [
                "",
                "",
                "",
                ""
            ],
            "correct_answer": "",
            "explanation": "",
            "difficulty": "medium"
        }},
        {{
            "question": "",
            "options": [
                "",
                "",
                "",
                ""
            ],
            "correct_answer": "",
            "explanation": "",
            "difficulty": "hard"
        }},
        {{
            "question": "",
            "options": [
                "",
                "",
                "",
                ""
            ],
            "correct_answer": "",
            "explanation": "",
            "difficulty": "medium"
        }},
        {{
            "question": "",
            "options": [
                "",
                "",
                "",
                ""
            ],
            "correct_answer": "",
            "explanation": "",
            "difficulty": "easy"
        }}
    ]
}}

Rules:

- Generate exactly 5 questions.
- Each question must have exactly 4 options.
- Only one option must be correct.
- The correct_answer must exactly match one of the options.
- Include a mixture of easy, medium, and hard questions.
- Questions should test important concepts rather than insignificant details.
- Do not ask questions about information that is not present in the transcript.
- Avoid ambiguous questions.
- The explanation should briefly explain why the correct answer is correct.
- Make the quiz useful for student revision.
- Return valid JSON only.

Transcript:

{transcript}

"""