from groq import Groq
from config import GROQ_API_KEY, MODEL_NAME

client = Groq(api_key=GROQ_API_KEY)


def ask_groq(prompt, system_prompt="You are a helpful AI assistant."):

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role":"system",
                "content":system_prompt
            },
            {
                "role":"user",
                "content":prompt
            }
        ],
        temperature=0.3
    )

    return response.choices[0].message.content