import json
import threading
import wave
import uuid
from pathlib import Path
from datetime import datetime, timezone

from flask_sock import Sock
from services.gnani_live_service import GnaniLiveSession


def register_live_subtitles(app):
    sock = Sock(app)

    @sock.route("/live-subtitles")
    def live_subtitles(ws):
        sample_rate, channels, sample_width, chunk_seconds = 16000, 1, 2, 5
        chunk_bytes = sample_rate * channels * sample_width * chunk_seconds
        session_id = str(uuid.uuid4())
        output_dir = Path(__file__).resolve().parents[1] / "captured_audio" / session_id
        output_dir.mkdir(parents=True, exist_ok=True)
        audio_buffer, chunks = bytearray(), []
        total_samples = chunk_index = 0
        started_at = datetime.now(timezone.utc).isoformat()
        session = GnaniLiveSession()
        stop_event = threading.Event()
        send_lock = threading.Lock()
        receiver = None

        def send_event(event):
            if stop_event.is_set():
                return False
            try:
                with send_lock:
                    ws.send(json.dumps(event))
                return True
            except Exception as exc:
                print("WebSocket send error:", exc)
                stop_event.set()
                return False

        def save_chunk(audio_bytes):
            nonlocal chunk_index, total_samples
            if not audio_bytes:
                return
            count = len(audio_bytes) // sample_width
            start_ms = round(total_samples / sample_rate * 1000)
            end_ms = round((total_samples + count) / sample_rate * 1000)
            filename = f"chunk_{chunk_index:04d}.wav"
            with wave.open(str(output_dir / filename), "wb") as wav:
                wav.setnchannels(channels)
                wav.setsampwidth(sample_width)
                wav.setframerate(sample_rate)
                wav.writeframes(audio_bytes)
            chunks.append({
                "chunk_index": chunk_index, "file": filename,
                "start_ms": start_ms, "end_ms": end_ms,
                "duration_ms": end_ms - start_ms,
                "sample_rate": sample_rate, "channels": channels, "format": "PCM16"
            })
            total_samples += count
            chunk_index += 1
            with open(output_dir / "manifest.json", "w", encoding="utf-8") as f:
                json.dump({
                    "session_id": session_id, "started_at": started_at,
                    "sample_rate": sample_rate, "format": "PCM16", "chunks": chunks
                }, f, indent=2)

        def receive_events():
            while not stop_event.is_set():
                event = session.get_event(timeout=0.1)
                if event and not send_event(event):
                    break

        try:
            ready = session.start()
            ready["session_id"] = session_id
            ready["message"] = "Gnani connected. Listening and saving audio."
            send_event(ready)
            receiver = threading.Thread(target=receive_events, daemon=True)
            receiver.start()

            while not stop_event.is_set():
                data = ws.receive()
                if data is None:
                    break
                if isinstance(data, bytes):
                    if len(data) != session.FRAME_SIZE:
                        continue
                    session.send_audio(data)
                    audio_buffer.extend(data)
                    while len(audio_buffer) >= chunk_bytes:
                        save_chunk(bytes(audio_buffer[:chunk_bytes]))
                        del audio_buffer[:chunk_bytes]
                elif isinstance(data, str):
                    try:
                        if json.loads(data).get("type") == "stop":
                            break
                    except json.JSONDecodeError:
                        pass
        except Exception as exc:
            print("Live subtitle error:", exc)
            send_event({"type": "error", "message": str(exc)})
        finally:
            if audio_buffer:
                try:
                    save_chunk(bytes(audio_buffer))
                except Exception as exc:
                    print("Final chunk save error:", exc)
            stop_event.set()
            if receiver and receiver.is_alive():
                receiver.join(timeout=1)
            session.close()
            print("Live capture complete:", session_id, "chunks:", len(chunks))
        return ""

    @sock.route("/live-subtitles-test")
    def live_subtitles_test(ws):
        sample_rate, channels, sample_width, chunk_seconds = 16000, 1, 2, 5
        chunk_bytes = sample_rate * channels * sample_width * chunk_seconds
        session_id = str(uuid.uuid4())
        output_dir = Path(__file__).resolve().parents[1] / "captured_audio" / session_id
        output_dir.mkdir(parents=True, exist_ok=True)
        audio_buffer, chunks = bytearray(), []
        total_samples = chunk_index = 0
        started_at = datetime.now(timezone.utc).isoformat()

        def save_chunk(data):
            nonlocal total_samples, chunk_index
            count = len(data) // sample_width
            start_ms = round(total_samples / sample_rate * 1000)
            end_ms = round((total_samples + count) / sample_rate * 1000)
            filename = f"chunk_{chunk_index:04d}.wav"
            with wave.open(str(output_dir / filename), "wb") as wav:
                wav.setnchannels(channels); wav.setsampwidth(sample_width)
                wav.setframerate(sample_rate); wav.writeframes(data)
            info = {
                "chunk_index": chunk_index, "file": filename, "start_ms": start_ms,
                "end_ms": end_ms, "duration_ms": end_ms-start_ms,
                "sample_rate": sample_rate, "channels": channels, "format": "PCM16"
            }
            chunks.append(info); total_samples += count; chunk_index += 1
            with open(output_dir / "manifest.json", "w", encoding="utf-8") as f:
                json.dump({"session_id": session_id, "started_at": started_at,
                           "sample_rate": sample_rate, "format": "PCM16", "chunks": chunks}, f, indent=2)
            try: ws.send(json.dumps({"type": "chunk_saved", **info}))
            except Exception: pass

        try:
            ws.send(json.dumps({"type": "ready", "message": "Local audio chunking ready. Gnani disabled.",
                                "session_id": session_id}))
            while True:
                data = ws.receive()
                if data is None: break
                if isinstance(data, str):
                    try:
                        if json.loads(data).get("type") == "stop": break
                    except json.JSONDecodeError: pass
                elif isinstance(data, bytes) and len(data) == 1024:
                    audio_buffer.extend(data)
                    while len(audio_buffer) >= chunk_bytes:
                        save_chunk(bytes(audio_buffer[:chunk_bytes]))
                        del audio_buffer[:chunk_bytes]
        except Exception as exc:
            print("Local audio test error:", exc)
        finally:
            if audio_buffer: save_chunk(bytes(audio_buffer))
        return ""
