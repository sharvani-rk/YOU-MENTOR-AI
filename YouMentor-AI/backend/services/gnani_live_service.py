
"""Gnani Prisma v3 real-time streaming STT client."""

import asyncio
import json
import threading
from queue import Queue, Empty

import websockets
from config import GNANI_API_KEY


class GnaniLiveSession:
    FRAME_SIZE = 1024
    WEBSOCKET_URL = "wss://api.vachana.ai/stt/v3/stream"

    def __init__(self):
        api_key = (GNANI_API_KEY or "").strip()

        if not api_key:
            raise ValueError(
                "GNANI_API_KEY is missing from backend/.env"
            )

        self.api_key = api_key
        self.websocket = None
        self.loop = asyncio.new_event_loop()
        self.thread = None
        self.event_queue = Queue()
        self.audio_queue = None
        self.consumer_task = None
        self.sender_task = None
        self.connected = False
        self.stopping = False
        self.loop_ready = threading.Event()
        self._close_lock = threading.Lock()

    def start(self):
        self.thread = threading.Thread(
            target=self._run_loop,
            daemon=True
        )
        self.thread.start()

        if not self.loop_ready.wait(timeout=5):
            raise RuntimeError(
                "Gnani event loop failed to start."
            )

        try:
            future = asyncio.run_coroutine_threadsafe(
                self._connect(),
                self.loop
            )
            return future.result(timeout=25)

        except Exception as exc:
            self.close()
            raise RuntimeError(
                f"Gnani WebSocket connection failed: {exc}"
            ) from exc

    def _run_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop_ready.set()
        self.loop.run_forever()

    async def _connect(self):
        self.audio_queue = asyncio.Queue(maxsize=100)

        headers = {
            "x-api-key-id": self.api_key,
            "language_code": "indic-auto",
            "model": "prisma-v3.0",
            "x-sample-rate": "16000",
            "format": "codemix",
            "x-vad-threshold": "0.7",
            "x-min-silence-ms": "50",
            "x-min-speech-ms": "100",
            "x-min-segment-ms": "100",
        }

        try:
            self.websocket = await websockets.connect(
                self.WEBSOCKET_URL,
                additional_headers=headers,
                open_timeout=15,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=10,
            )

        except Exception as exc:
            status = getattr(exc, "status_code", None)

            if status == 401:
                raise RuntimeError(
                    "Gnani rejected WebSocket authentication (401). "
                    "Check the API key and account permissions."
                ) from exc

            raise RuntimeError(
                f"WebSocket handshake failed: {exc}"
            ) from exc

        try:
            raw = await asyncio.wait_for(
                self.websocket.recv(),
                timeout=10
            )

            print("GNANI INITIAL RESPONSE:", raw)

            response = json.loads(raw)

            if response.get("type") == "error":
                raise RuntimeError(
                    response.get(
                        "message",
                        "Gnani connection failed."
                    )
                )

            if response.get("type") != "connected":
                raise RuntimeError(
                    f"Unexpected Gnani response: {response}"
                )

            self.connected = True

            self.consumer_task = asyncio.create_task(
                self._receive_events()
            )

            self.sender_task = asyncio.create_task(
                self._send_audio_queue()
            )

            config = response.get("config", {})

            return {
                "type": "ready",
                "message": response.get(
                    "message",
                    "Gnani connected."
                ),
                "sample_rate": config.get(
                    "sample_rate",
                    16000
                ),
                "chunk_size": config.get(
                    "chunk_size",
                    512
                ),
            }

        except Exception:
            await self.websocket.close()
            self.websocket = None
            self.connected = False
            raise

    async def _receive_events(self):
        try:
            async for raw in self.websocket:
                print("GNANI RAW EVENT:", raw)

                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    print("GNANI: Invalid JSON event")
                    continue

                kind = event.get("type")

                print("GNANI EVENT TYPE:", kind)

                if kind == "transcript":
                    text = event.get("text", "").strip()

                    print("GNANI TRANSCRIPT:", text)

                    if text:
                        self.event_queue.put({
                            "type": "transcript",
                            "text": text,
                            "language": event.get(
                                "detected_language_code"
                            ),
                            "segment_id": event.get("segment_id"),
                            "segment_index": event.get("segment_index"),
                            "audio_duration_ms": event.get(
                                "audio_duration_ms"
                            ),
                            "latency": event.get("latency"),
                            "timestamp": event.get("timestamp"),
                        })

                elif kind in ("processing", "speech_start"):
                    self.event_queue.put({
                        "type": kind,
                        "timestamp": event.get("timestamp")
                    })

                elif kind == "error":
                    message = event.get(
                        "message",
                        "Gnani streaming error."
                    )

                    print("GNANI SERVER ERROR:", message)

                    self.event_queue.put({
                        "type": "error",
                        "message": message
                    })

                else:
                    print("GNANI UNHANDLED EVENT:", event)

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            if not self.stopping:
                print("GNANI RECEIVE ERROR:", repr(exc))

                self.event_queue.put({
                    "type": "error",
                    "message": str(exc)
                })

        finally:
            if not self.stopping:
                self.connected = False
                print("GNANI RECEIVE LOOP CLOSED")

                self.event_queue.put({
                    "type": "error",
                    "message": "Gnani WebSocket connection closed."
                })

    async def _send_audio_queue(self):
        try:
            while True:
                audio = await self.audio_queue.get()

                try:
                    if audio is None:
                        return

                    if (
                        self.websocket
                        and self.websocket.state
                        == websockets.State.OPEN
                    ):
                        await self.websocket.send(audio)
                    else:
                        raise RuntimeError(
                            "Gnani WebSocket is no longer open."
                        )

                finally:
                    self.audio_queue.task_done()

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            if not self.stopping:
                print("GNANI AUDIO SEND ERROR:", repr(exc))

                self.event_queue.put({
                    "type": "error",
                    "message": f"Audio streaming failed: {exc}"
                })

    async def _enqueue_audio(self, audio):
        await self.audio_queue.put(audio)

    def send_audio(self, audio_data):
        if not self.connected or self.stopping:
            raise RuntimeError(
                "Gnani streaming session is not connected."
            )

        if (
            not isinstance(audio_data, bytes)
            or len(audio_data) != self.FRAME_SIZE
        ):
            raise ValueError(
                f"Expected {self.FRAME_SIZE}-byte audio frame; "
                f"received {len(audio_data) if isinstance(audio_data, bytes) else 'non-bytes'}."
            )

        future = asyncio.run_coroutine_threadsafe(
            self._enqueue_audio(audio_data),
            self.loop
        )

        future.result(timeout=2)

    def get_event(self, timeout=0.03):
        try:
            return self.event_queue.get(timeout=timeout)
        except Empty:
            return None

    def close(self):
        with self._close_lock:
            if self.stopping:
                return

            self.stopping = True
            self.connected = False

            if not self.loop.is_running():
                return

            async def shutdown():
                for task in (
                    self.sender_task,
                    self.consumer_task
                ):
                    if task and not task.done():
                        task.cancel()

                        try:
                            await task
                        except asyncio.CancelledError:
                            pass

                if self.websocket:
                    try:
                        await self.websocket.close()
                    except Exception as exc:
                        print(
                            "Gnani shutdown warning:",
                            exc
                        )

            try:
                asyncio.run_coroutine_threadsafe(
                    shutdown(),
                    self.loop
                ).result(timeout=10)

            except Exception as exc:
                print(
                    "Gnani shutdown warning:",
                    exc
                )

            finally:
                self.loop.call_soon_threadsafe(
                    self.loop.stop
                )

                if self.thread:
                    self.thread.join(timeout=3)

                if not self.loop.is_closed():
                    self.loop.close()
