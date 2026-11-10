from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import YouTubeTranscriptApi


def extract_video_id(url: str) -> str:
    """
    Extract the YouTube video ID from different URL formats.
    """

    parsed = urlparse(url)

    # Standard YouTube URL
    if parsed.hostname in ["www.youtube.com", "youtube.com"]:
        return parse_qs(parsed.query).get("v", [None])[0]

    # Short YouTube URL
    elif parsed.hostname == "youtu.be":
        return parsed.path.lstrip("/")

    return None


def get_transcript(video_url: str) -> str:
    """
    Fetch and return the transcript as plain text.
    """

    video_id = extract_video_id(video_url)

    if not video_id:
        raise ValueError("Invalid YouTube URL")

    api = YouTubeTranscriptApi()

    transcript = api.fetch(video_id)

    text = " ".join(snippet.text for snippet in transcript)

    return text