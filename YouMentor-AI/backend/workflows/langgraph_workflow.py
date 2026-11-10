from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.audio_agent import transcribe_audio_file
from agents.transcript_agent import get_transcript
from agents.summary_agent import generate_summary_from_text
from agents.explanation_agent import generate_explanation_from_transcript
from agents.quiz_agent import generate_quiz_from_transcript
from agents.vocabulary_agent import generate_vocabulary_from_transcript
from agents.flashcard_agent import generate_flashcards_from_transcript


class LearningState(TypedDict, total=False):
    """Shared state passed between YouMentor workflow nodes."""
    video_url: str
    audio_path: str
    language_code: str
    task: str
    transcript: str
    result: object


def select_transcript_source(state: LearningState) -> Literal["audio", "provided", "video"]:
    if state.get("audio_path"):
        return "audio"
    if state.get("transcript"):
        return "provided"
    if state.get("video_url"):
        return "video"
    raise ValueError("A YouTube URL, audio file, or transcript is required.")


def retrieve_transcript(state: LearningState) -> dict:
    """Retrieve a transcript from a YouTube video."""
    transcript = get_transcript(state["video_url"])
    if not transcript or not transcript.strip():
        raise ValueError("No transcript content was available for this video.")
    return {"transcript": transcript}


def transcribe_uploaded_audio(state: LearningState) -> dict:
    """Use the Gnani agent to transcribe uploaded audio."""
    transcript = transcribe_audio_file(
        state["audio_path"],
        state.get("language_code", "en-IN"),
    )
    if not transcript or not transcript.strip():
        raise ValueError("Gnani did not return any transcript text.")
    return {"transcript": transcript}


def run_summary_agent(state: LearningState) -> dict:
    return {"result": generate_summary_from_text(state["transcript"])}


def run_explanation_agent(state: LearningState) -> dict:
    return {"result": generate_explanation_from_transcript(state["transcript"])}


def run_quiz_agent(state: LearningState) -> dict:
    return {"result": generate_quiz_from_transcript(state["transcript"])}


def run_vocabulary_agent(state: LearningState) -> dict:
    return {"result": generate_vocabulary_from_transcript(state["transcript"])}


def run_flashcard_agent(state: LearningState) -> dict:
    return {"result": generate_flashcards_from_transcript(state["transcript"])}


def select_agent(state: LearningState) -> Literal[
    "summary", "explanation", "quiz", "vocabulary", "flashcards"
]:
    task = state.get("task", "")
    allowed = {"summary", "explanation", "quiz", "vocabulary", "flashcards"}
    if task not in allowed:
        raise ValueError(f"Unsupported learning task: {task}")
    return task


def build_learning_graph():
    """Compile the YouMentor workflow for YouTube and audio learning."""
    graph = StateGraph(LearningState)
    graph.add_node("retrieve_transcript", retrieve_transcript)
    graph.add_node("transcribe_audio", transcribe_uploaded_audio)
    graph.add_node("route_task", lambda state: {})
    graph.add_node("summary", run_summary_agent)
    graph.add_node("explanation", run_explanation_agent)
    graph.add_node("quiz", run_quiz_agent)
    graph.add_node("vocabulary", run_vocabulary_agent)
    graph.add_node("flashcards", run_flashcard_agent)

    graph.add_conditional_edges(
        START,
        select_transcript_source,
        {
            "video": "retrieve_transcript",
            "audio": "transcribe_audio",
            "provided": "route_task",
        },
    )
    graph.add_edge("retrieve_transcript", "route_task")
    graph.add_edge("transcribe_audio", "route_task")
    graph.add_conditional_edges(
        "route_task",
        select_agent,
        {
            "summary": "summary",
            "explanation": "explanation",
            "quiz": "quiz",
            "vocabulary": "vocabulary",
            "flashcards": "flashcards",
        },
    )
    for node in ("summary", "explanation", "quiz", "vocabulary", "flashcards"):
        graph.add_edge(node, END)
    return graph.compile()


learning_graph = build_learning_graph()


def run_learning_workflow(video_url: str, task: str):
    """Run a YouTube learning task through LangGraph."""
    if not video_url:
        raise ValueError("Video URL is required.")
    final_state = learning_graph.invoke({"video_url": video_url, "task": task})
    return final_state["result"]


def run_audio_learning_workflow(audio_path: str, language_code: str = "en-IN"):
    """Transcribe uploaded audio with Gnani, then summarize via LangGraph."""
    if not audio_path:
        raise ValueError("Audio file path is required.")
    final_state = learning_graph.invoke({
        "audio_path": audio_path,
        "language_code": language_code,
        "task": "summary",
    })
    return {
        "transcript": final_state["transcript"],
        "summary": final_state["result"],
    }
