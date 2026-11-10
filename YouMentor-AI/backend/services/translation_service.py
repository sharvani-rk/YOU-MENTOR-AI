"""Translate live transcript segments with Groq.

Important: translation is strict when a concrete target language is selected.
The function raises an error rather than returning the source transcript as
though it were a successful translation.
"""
from services.groq_service import ask_groq

LANGUAGES = {
    "original": "Original language",
    "none": "No subtitles",
    "en": "English",
    "english": "English",
    "te": "Telugu",
    "telugu": "Telugu",
    "hi": "Hindi",
    "hindi": "Hindi",
    "ta": "Tamil",
    "tamil": "Tamil",
    "kn": "Kannada",
    "kannada": "Kannada",
    "ml": "Malayalam",
    "malayalam": "Malayalam",
    "mr": "Marathi",
    "marathi": "Marathi",
    "bn": "Bengali",
    "bengali": "Bengali",
    "gu": "Gujarati",
    "gujarati": "Gujarati",
    "pa": "Punjabi",
    "punjabi": "Punjabi",
    "hinglish": "Hinglish (Hindi-English code-mix)",
    "tenglish": "Tenglish (Telugu-English code-mix)",
    "benglish": "Benglish (Bengali-English code-mix)",
}


def translate_text(text: str, target_language: str, source_language: str = "auto") -> str:
    """Translate one STT segment into the selected output language."""
    if not isinstance(text, str) or not text.strip():
        return ""

    key = str(target_language or "original").strip().lower()
    if key in ("original", "none", ""):
        return text.strip()

    target = LANGUAGES.get(key)
    if not target:
        raise ValueError(f"Unsupported subtitle language: {target_language}")

    if key in ("en", "english"):
        output_rules = """
- Output natural, grammatically correct English only.
- Use English words and normal English spelling.
- Do not write Telugu words in Latin letters.
- Do not produce Tenglish, transliteration, or a Telugu-English mixture.
- Translate the Telugu meaning, including Telugu words written in Latin script.
- Preserve names and the speaker's intended meaning.
- Return only the final English translation.
"""
    elif key in ("te", "telugu"):
        output_rules = """
- Output natural Telugu in Telugu script.
- Do not transliterate Telugu speech into Latin letters.
- Preserve names and intended meaning.
- Return only the Telugu translation.
"""
    elif key == "hinglish":
        output_rules = """
- Produce natural Hindi-English code-mixed speech in Latin script.
- Do not turn the entire output into formal Hindi.
- Return only the translated segment.
"""
    elif key == "tenglish":
        output_rules = """
- Produce natural Telugu-English code-mixed speech.
- Use Telugu script for Telugu words and English spelling for English words.
- Return only the translated segment.
"""
    elif key == "benglish":
        output_rules = """
- Produce natural Bengali-English code-mixed speech.
- Return only the translated segment.
"""
    else:
        output_rules = f"""
- Output only natural {target} in its normal writing system.
- Do not transliterate the output into English letters.
- Return only the translated segment.
"""

    prompt = f"""You are translating a short segment from live spoken audio.

Target language: {target}
Detected/source language from speech recognition: {source_language}

Translation requirements:
- Translate the meaning; do not merely copy or transliterate the source.
- Short speech fragments are valid. Translate them as naturally as possible.
- Preserve names, numbers, references, and the speaker's tone.
- Do not add explanations, labels, quotation marks, or commentary.
{output_rules}

Transcript segment:
{text}

Final translation:"""

    result = ask_groq(
        prompt,
        "You are a highly accurate multilingual speech translator. Follow the requested output language and script exactly."
    )
    translated = str(result or "").strip().strip('"').strip("'")

    if not translated:
        raise RuntimeError("The translation model returned an empty result.")

    # Defensive check for an English request: do not accept a result identical
    # to a non-English/romanized source as a successful translation.
    if key in ("en", "english") and translated.casefold() == text.strip().casefold():
        raise RuntimeError(
            "The model returned the original transcript instead of an English translation. Please retry this segment."
        )

    return translated