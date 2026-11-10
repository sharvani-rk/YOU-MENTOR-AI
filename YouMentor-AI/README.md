# YouMentor AI — Multilingual Live Subtitle & Voice Edition

This package is an integrated update of the supplied YouMentor AI project.

## Included
- Existing Summary, Explain, Quiz, Vocabulary, Flashcards, Notes and uploaded-audio learning features.
- Chrome Manifest V3 extension.
- YouTube tab-audio capture through an offscreen document.
- Gnani Prisma streaming STT with automatic Indian-language detection and code-mix mode.
- Live subtitle language selection: Original, None, English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Hinglish, Tenglish and Benglish.
- Optional translated speech using Gnani Timbre v3.0.
- Voice selection from the documented Timbre v3.0 voice names.
- Subtitle translation is sent to the overlay before TTS generation, so speech synthesis does not block the initial caption display.

## Important voice note
The TTS documentation supplied for this project lists Timbre v3.0 voice names (Shivani, Avinash, Lakshmi, Kalpana, Shubham, Prakash, Devansh, Yashraj, Chetana, Vasudha, Riyaa, Tarika and Harshad), but it does not classify them by gender or age. The extension therefore offers the real voice names and does not claim that a voice is a child, woman, man or girl. Check the provider's voice samples/catalog before assigning character labels. A dedicated child voice is not established by the supplied documentation.

## Requirements
- Python 3.10 or newer.
- Google Chrome with Manifest V3 offscreen-document and tab-capture support.
- A Groq API key.
- A Gnani API key with STT and TTS scopes.
- Internet connection for Groq and Gnani requests.

## Backend setup (Windows PowerShell)
1. Open a terminal in the `backend` directory.
2. Create a virtual environment:
   ```powershell
   py -3.12 -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` inside `backend`.
5. Add your own `GROQ_API_KEY` and `GNANI_API_KEY` to `backend/.env`. Never share this file or commit it.
6. Start the backend:
   ```powershell
   python main.py
   ```
7. Confirm `http://127.0.0.1:5000/` responds.

## Chrome extension setup
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `extension` folder from this project.
5. Open or refresh a YouTube video tab after loading the extension.
6. Start a YouTube video, open YouMentor AI, choose subtitle/audio languages and a Timbre voice, then click **Start Live Subtitles**.
7. Stop the session using **Stop**.

The extension captures the active YouTube tab's audio, not the laptop microphone. The video tab must be active when starting capture. Refresh the YouTube tab after reloading/updating the extension so the content script is available.

## Language behavior
- STT uses `indic-auto` and `codemix` for automatic multilingual/code-mixed recognition.
- English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati and Punjabi are mapped to documented Gnani TTS language codes.
- Hinglish maps to `hi-en`.
- Tenglish and Benglish are composed by Groq translation and passed to Gnani TTS with `auto` script detection. These are app-level mixed-language modes, not dedicated documented Gnani TTS language codes.
- Subtitle and speech language settings are independent. `No subtitles` and `No audio` disable their respective output.

## Latency and API usage
- The STT stream uses the documented 100 ms minimum silence/speech/segment settings. This can reduce pause waiting but may split speech into shorter segments.
- Gnani's documented streaming transcript events are completed segments, not guaranteed word-by-word interim captions.
- Selecting a translated subtitle makes a Groq request for each completed segment.
- Enabling speech makes a Gnani TTS request for each completed segment. This consumes TTS credits and may introduce speech delay. Keep audio set to **No audio** while testing captions.
- TTS is queued serially in the extension's background worker to preserve segment order.

## Troubleshooting
- If the popup says the backend is unreachable, start Flask and check `http://127.0.0.1:5000/`.
- If live capture cannot connect, verify the API key has STT scope and that `websockets` and `flask-sock` installed successfully.
- If TTS fails, verify the API key has TTS scope and that the selected Timbre voice is valid for `timbre-v3.0`.
- If the overlay does not appear, refresh the YouTube tab and start the session again.
- Check the backend terminal for the exact API error. Do not paste API keys into chat.

## Existing learning functionality
The original learning routes, agents, prompts, notebook files and UI styles are retained from the supplied archive. The virtual environment and the original `.env` file are intentionally not included in this ZIP. Install dependencies and recreate `.env` from `.env.example`.
