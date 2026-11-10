
let mediaStream = null;
let audioContext = null;
let processor = null;
let sourceNode = null;
let outputGainNode = null;
let socket = null;

let pendingBytes = new Uint8Array(0);
let stopping = false;
let diagnosticCounter = 0;

// Send events to the extension background service worker.
function emit(event) {
    chrome.runtime.sendMessage({
        type: "LIVE_SUBTITLE_EVENT",
        event
    }).catch(() => {});
}

// Convert Float32 audio into signed 16-bit PCM.
function floatTo16BitPCM(float32) {
    const output = new Int16Array(float32.length);

    for (let i = 0; i < float32.length; i++) {
        const sample = Math.max(-1, Math.min(1, float32[i]));

        output[i] = sample < 0
            ? sample * 0x8000
            : sample * 0x7fff;
    }

    return new Uint8Array(output.buffer);
}

// Buffer and send audio in 1024-byte frames.
function appendAndSend(bytes) {
    const merged = new Uint8Array(
        pendingBytes.length + bytes.length
    );

    merged.set(pendingBytes);
    merged.set(bytes, pendingBytes.length);

    let offset = 0;

    while (merged.length - offset >= 1024) {
        const frame = merged.slice(offset, offset + 1024);

        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(frame);
        }

        offset += 1024;
    }

    pendingBytes = merged.slice(offset);
}

// Start capturing YouTube tab audio.
async function startCapture(streamId, backendUrl) {
    await stopCapture();

    stopping = false;
    diagnosticCounter = 0;

    if (!streamId) {
        throw new Error("Chrome tab capture stream ID is missing.");
    }

    if (!backendUrl) {
        throw new Error("Backend WebSocket URL is missing.");
    }

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        const tracks = mediaStream.getAudioTracks();

        if (!tracks.length) {
            throw new Error("No audio track received from YouTube.");
        }

        console.log("Audio capture started.");
        console.log("Audio tracks:", tracks.length);
        console.log("Track settings:", tracks[0].getSettings());

        audioContext = new AudioContext({
            sampleRate: 16000
        });

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        console.log(
            "Actual AudioContext sample rate:",
            audioContext.sampleRate
        );

        sourceNode = audioContext.createMediaStreamSource(
            mediaStream
        );

        processor = audioContext.createScriptProcessor(
            512,
            1,
            1
        );

        outputGainNode = audioContext.createGain();
        outputGainNode.gain.value = 1;

        // Audio path:
        // YouTube -> Source -> Processor -> Gain -> Speakers
        sourceNode.connect(processor);
        processor.connect(outputGainNode);
        outputGainNode.connect(audioContext.destination);

        processor.onaudioprocess = (event) => {
            if (stopping) return;

            const input = event.inputBuffer.getChannelData(0);
            const output = event.outputBuffer.getChannelData(0);

            // Always preserve original YouTube audio.
            output.set(input);

            // Measure captured audio.
            let peak = 0;
            let sumSquares = 0;

            for (let i = 0; i < input.length; i++) {
                const value = input[i];

                peak = Math.max(peak, Math.abs(value));
                sumSquares += value * value;
            }

            const rms = Math.sqrt(
                sumSquares / input.length
            );

            // Print diagnostics periodically.
            diagnosticCounter++;

            if (diagnosticCounter % 100 === 0) {
                console.log(
                    "CAPTURE DIAGNOSTICS:",
                    "Peak:", peak.toFixed(5),
                    "RMS:", rms.toFixed(5),
                    "Sample rate:", audioContext.sampleRate
                );
            }

            // Do not send silent frames.
            if (peak <= 0.001) {
                return;
            }

            // Only stream when the backend socket is connected.
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                return;
            }

            // IMPORTANT: Convert Float32 to PCM16.
            const pcmBytes = floatTo16BitPCM(input);

            appendAndSend(pcmBytes);
        };

        // Connect to Flask WebSocket.
        socket = new WebSocket(backendUrl);
        socket.binaryType = "arraybuffer";

        socket.onopen = () => {
            console.log("Backend WebSocket connected.");

            emit({
                type: "ready",
                message: "Audio capture connected. Listening for speech..."
            });
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("Backend event:", data);
                emit(data);
            } catch (error) {
                console.warn(
                    "Ignoring non-JSON WebSocket message:",
                    error
                );
            }
        };

        socket.onerror = (error) => {
            console.error("Backend WebSocket error:", error);

            emit({
                type: "error",
                message: "Live subtitle WebSocket connection failed."
            });
        };

        socket.onclose = () => {
            console.log("Backend WebSocket closed.");

            if (!stopping) {
                emit({
                    type: "error",
                    message: "Live subtitle connection closed."
                });
            }
        };

    } catch (error) {
        console.error("Audio capture startup error:", error);

        await stopCapture();

        throw error;
    }
}

// Mute or restore original YouTube audio.
function setOriginalAudioMuted(muted) {
    if (
        !outputGainNode ||
        !audioContext ||
        audioContext.state === "closed"
    ) {
        return false;
    }

    outputGainNode.gain.setTargetAtTime(
        muted ? 0 : 1,
        audioContext.currentTime,
        0.025
    );

    return true;
}

// Stop capture and restore original audio.
async function stopCapture() {
    stopping = true;

    // Restore original YouTube audio first.
    try {
        if (
            outputGainNode &&
            audioContext &&
            audioContext.state !== "closed"
        ) {
            outputGainNode.gain.cancelScheduledValues(
                audioContext.currentTime
            );

            outputGainNode.gain.setValueAtTime(
                1,
                audioContext.currentTime
            );
        }
    } catch (error) {
        console.warn("Audio restoration warning:", error);
    }

    // Notify Flask that streaming is stopping.
    try {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "stop"
            }));
        }
    } catch (error) {
        console.warn("Socket stop warning:", error);
    }

    // Disconnect audio nodes.
    try {
        if (processor) {
            processor.onaudioprocess = null;
            processor.disconnect();
        }

        sourceNode?.disconnect();
        outputGainNode?.disconnect();

    } catch (error) {
        console.warn("Audio disconnect warning:", error);
    }

    // Stop media tracks.
    try {
        mediaStream?.getTracks().forEach(track => {
            track.stop();
        });
    } catch (error) {
        console.warn("Media track stop warning:", error);
    }

    // Close audio context.
    try {
        if (
            audioContext &&
            audioContext.state !== "closed"
        ) {
            await audioContext.close();
        }
    } catch (error) {
        console.warn("Audio context close warning:", error);
    }

    // Close backend socket.
    try {
        socket?.close();
    } catch (error) {
        console.warn("Socket close warning:", error);
    }

    // Reset everything.
    mediaStream = null;
    audioContext = null;
    processor = null;
    sourceNode = null;
    outputGainNode = null;
    socket = null;

    pendingBytes = new Uint8Array(0);

    console.log("Audio capture stopped.");
}

// Messages from background.js.
chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (message?.target !== "offscreen") {
            return;
        }

        if (message.type === "START_AUDIO_CAPTURE") {
            startCapture(
                message.streamId,
                message.backendUrl
            )
            .then(() => {
                sendResponse({
                    success: true
                });
            })
            .catch(error => {
                console.error(
                    "Audio startup failed:",
                    error
                );

                sendResponse({
                    success: false,
                    message: error.message ||
                        "Could not start audio capture."
                });
            });

            return true;
        }

        if (message.type === "SET_ORIGINAL_AUDIO_MUTED") {
            const success = setOriginalAudioMuted(
                Boolean(message.muted)
            );

            sendResponse({
                success,
                message: success
                    ? "Original audio updated."
                    : "Audio capture is not active."
            });

            return;
        }

        if (message.type === "STOP_AUDIO_CAPTURE") {
            stopCapture()
                .then(() => {
                    sendResponse({
                        success: true
                    });
                });

            return true;
        }
    }
);
