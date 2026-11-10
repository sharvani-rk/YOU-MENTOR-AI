const BACKEND_URL = "http://127.0.0.1:5000";
const LIVE_WS_URL = "ws://127.0.0.1:5000/live-subtitles";

let activeTabId = null;

let liveSettings = {
    subtitleLanguage: "original",
    audioLanguage: "none",
    voice: "Shivani",
    voiceMode: "automatic"
};

let liveVoiceEnabled = false;
let captureStarting = false;
let captureRunning = false;
let processingSegment = false;
let sessionId = 0;

const segmentQueue = [];
const speakerVoiceAssignments = new Map();

let nextVoiceIndex = 0;

// Provider voice identifiers.
// Their demographic characteristics must be verified separately.
const AUTOMATIC_VOICE_POOL = [
    "Shivani",
    "Avinash",
    "Lakshmi",
    "Shubham",
    "Prakash",
    "Chetana"
];


// --------------------------------------------------
// OFFSCREEN DOCUMENT
// --------------------------------------------------

async function ensureOffscreenDocument() {
    const url = chrome.runtime.getURL("offscreen.html");

    const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [url]
    });

    if (contexts.length) return;

    await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification:
            "Capture YouTube tab audio and stream it to Gnani STT."
    });
}


// --------------------------------------------------
// COMMUNICATION
// --------------------------------------------------

async function sendToTab(tabId, message) {
    if (tabId == null) return;

    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
        console.warn(
            "Could not message YouTube tab. Refresh the tab after loading the extension.",
            err
        );
    }
}


function notifyPopup(event) {
    chrome.runtime.sendMessage({
        type: "LIVE_SUBTITLE_UI_EVENT",
        event
    }).catch(() => {});
}


// --------------------------------------------------
// SPEAKER VOICE ASSIGNMENT
// --------------------------------------------------

function getSpeakerId(event) {
    const value =
        event.speaker_id ??
        event.speakerId ??
        event.speaker;

    if (value == null || String(value).trim() === "") {
        return "speaker-default";
    }

    return String(value);
}


function getVoiceForSpeaker(event) {
    const speakerId = getSpeakerId(event);

    if (!speakerVoiceAssignments.has(speakerId)) {

        const voice = AUTOMATIC_VOICE_POOL[
            nextVoiceIndex % AUTOMATIC_VOICE_POOL.length
        ];

        speakerVoiceAssignments.set(speakerId, voice);
        nextVoiceIndex++;

        notifyPopup({
            type: "speaker_detected",
            speakerId,
            voice,
            message:
                `Speaker ${speakerId} assigned an automatic voice.`
        });
    }

    return speakerVoiceAssignments.get(speakerId);
}


// --------------------------------------------------
// BACKEND RESPONSE VALIDATION
// --------------------------------------------------

async function readJsonResponse(response, operationName) {

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `${operationName} returned an invalid response.`
        );
    }

    if (!response.ok || !data || !data.success) {
        throw new Error(
            data?.message ||
            data?.error ||
            `${operationName} failed. HTTP ${response.status}`
        );
    }

    return data;
}


// --------------------------------------------------
// PROCESS LIVE TRANSCRIPT SEGMENTS
// --------------------------------------------------


async function processNextSegment() {
    if (processingSegment || !segmentQueue.length) {
        return;
    }

    processingSegment = true;

    const queued = segmentQueue.shift();
    const event = queued.event;
    const currentSession = queued.sessionId;

    try {
        if (
            currentSession !== sessionId ||
            activeTabId == null
        ) {
            return;
        }

        const settings = { ...liveSettings };

        const subtitleLanguage =
            settings.subtitleLanguage || "original";

        const audioLanguage =
            settings.audioLanguage || "none";

        const originalText = event.text.trim();
        let subtitleText =
    subtitleLanguage === "none" ? "" : originalText;
        // ------------------------------------------
// STEP 1: TRANSLATE SUBTITLES
// Subtitle failure must NOT stop AI voice.
// ------------------------------------------

if (
    subtitleLanguage !== "original" &&
    subtitleLanguage !== "none"
) {
    try {
        const response = await fetch(
            `${BACKEND_URL}/translate-live-segment`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: event.text,
                    subtitle_language: subtitleLanguage,
                    source_language: event.language || "auto"
                })
            }
        );

        const translated = await readJsonResponse(
            response,
            "Subtitle translation"
        );

        subtitleText = String(
            translated.translated_text || ""
        ).trim();

        if (!subtitleText) {
            throw new Error("Translation returned empty text.");
        }

    } catch (translationError) {
        console.error(
            "Subtitle translation failed:",
            translationError
        );

        notifyPopup({
            type: "error",
            message:
                "Subtitle translation failed: " +
                translationError.message +
                ". AI voice will continue independently."
        });

        // Keep the original transcript visible if translation fails.
        subtitleText = originalText;
    }
    // Display the transcript/subtitle independently of AI Voice.
    if (
    currentSession === sessionId &&
    activeTabId != null &&
    subtitleText
    ) {
    await sendToTab(activeTabId, {
        type: "DISPLAY_LIVE_SUBTITLE",
        text: subtitleText
    });

    notifyPopup({
        type: "transcript",
        text: subtitleText
    });
    }
}

        // ==========================================
        // STEP 2: AI VOICE (INDEPENDENT)
        // ==========================================

        if (
            liveVoiceEnabled &&
            audioLanguage !== "none" &&
            currentSession === sessionId &&
            activeTabId != null
        ) {
            let selectedVoice;

            if (settings.voiceMode === "automatic") {
                selectedVoice = getVoiceForSpeaker(event);
            } else {
                selectedVoice = settings.voice || "Shivani";
            }

            const speechResponse = await fetch(
                `${BACKEND_URL}/synthesize-live-segment`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        text: originalText,
                        audio_language: audioLanguage,
                        detected_language: event.language || "auto",
                        voice: selectedVoice,
                        speaker_id: getSpeakerId(event)
                    })
                }
            );

            const speech = await readJsonResponse(
                speechResponse,
                "Speech synthesis"
            );

            if (
                currentSession !== sessionId ||
                !liveVoiceEnabled ||
                activeTabId == null
            ) {
                return;
            }

            if (!speech.audio_base64) {
                throw new Error(
                    "TTS response did not contain audio data."
                );
            }

            await sendToTab(activeTabId, {
                type: "DISPLAY_LIVE_SUBTITLE",
                text: "",
                audioBase64: speech.audio_base64,
                audioMime: speech.audio_mime || "audio/wav"
            });
        }

    } catch (err) {
        console.error(
            "Live segment processing failed:",
            err
        );

        notifyPopup({
            type: "error",
            message: err.message
        });

    } finally {
        processingSegment = false;

        if (segmentQueue.length) {
            processNextSegment();
        }
    }
}

// --------------------------------------------------
// START AUDIO CAPTURE FOR LISTENING OR AI VOICE
// --------------------------------------------------

async function startLiveCapture(tabId, enableVoice = false) {
    if (captureStarting) {
        throw new Error("Audio capture is already starting. Please wait.");
    }

    if (captureRunning && activeTabId === tabId) {
        if (enableVoice) {
            liveVoiceEnabled = true;
        }

        return {
            success: true,
            alreadyRunning: true
        };
    }

    captureStarting = true;

    try {
        // Stop any previous capture.
        await chrome.runtime.sendMessage({
            target: "offscreen",
            type: "STOP_AUDIO_CAPTURE"
        }).catch(() => {});

        // Start a fresh session.
        sessionId++;
        segmentQueue.length = 0;

        speakerVoiceAssignments.clear();
        nextVoiceIndex = 0;

        liveVoiceEnabled = enableVoice;
        activeTabId = tabId;

        // Inject the YouTube content script.
        await chrome.scripting.executeScript({
            target: {
                tabId: activeTabId
            },
            files: ["content.js"]
        });

        // Restore saved language and voice settings.
        const stored = await chrome.storage.local.get(
            "youmentorLiveSettings"
        );

        if (stored.youmentorLiveSettings) {
            liveSettings = {
                ...liveSettings,
                ...stored.youmentorLiveSettings
            };
        }

        // Ensure offscreen document exists.
        await ensureOffscreenDocument();

        // Obtain YouTube tab audio.
        const streamId = await chrome.tabCapture.getMediaStreamId({
            targetTabId: activeTabId
        });

        // Start capture and connect to Gnani.
        const started = await chrome.runtime.sendMessage({
            target: "offscreen",
            type: "START_AUDIO_CAPTURE",
            streamId,
            backendUrl: LIVE_WS_URL
        });

        if (!started?.success) {
            throw new Error(
                started?.message || "Audio capture failed."
            );
        }

        captureRunning = true;

        return {
            success: true
        };

    } catch (error) {
        // Clean up a partially started capture before resetting session state.
        await chrome.runtime.sendMessage({
            target: "offscreen",
            type: "STOP_AUDIO_CAPTURE"
        }).catch(() => {});

        captureRunning = false;
        activeTabId = null;
        liveVoiceEnabled = false;
        segmentQueue.length = 0;

        throw error;

    } finally {
        captureStarting = false;
    }
}


// --------------------------------------------------
// CHROME MESSAGE LISTENER
// --------------------------------------------------

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        // ------------------------------------------
        // UPDATE LANGUAGE AND VOICE SETTINGS
        // ------------------------------------------

        if (message?.type === "UPDATE_LIVE_SETTINGS") {

            liveSettings = {
                ...liveSettings,
                ...(message.settings || {})
            };

            sendResponse({
                success: true
            });

            return;
        }


        // ------------------------------------------
        // CAPTION VOICE: TRANSLATE + GENERATE SPEECH
        // ------------------------------------------

        if (message?.type === "CAPTION_VOICE_REQUEST") {

            (async () => {
                try {
                    const captionText = String(
                        message.captionText || ""
                    ).trim();

                    if (!captionText) {
                        throw new Error("Caption text is empty.");
                    }

                    const response = await fetch(
                        `${BACKEND_URL}/synthesize-live-segment`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                text: captionText,
                                audio_language: message.targetLanguage,
                                detected_language:
                                    message.sourceLanguage || "auto",
                                voice: message.voice || "Shivani"
                            })
                        }
                    );

                    const speech = await readJsonResponse(
                        response,
                        "Caption speech synthesis"
                    );

                    if (!speech.audio_base64) {
                        throw new Error(
                            "TTS response did not contain audio data."
                        );
                    }

                    sendResponse({
                        success: true,
                        translatedText:
                            speech.translated_text ||
                            speech.spoken_text ||
                            captionText,
                        audioBase64: speech.audio_base64,
                        audioMime:
                            speech.audio_mime || "audio/wav"
                    });

                } catch (error) {
                    console.error(
                        "Caption voice request failed:",
                        error
                    );

                    sendResponse({
                        success: false,
                        message: error.message
                    });
                }
            })();

            return true;
        }


        // ------------------------------------------
        // START / STOP AI VOICE INDEPENDENTLY
        // ------------------------------------------

        if (message?.type === "SET_LIVE_VOICE") {

            (async () => {
                try {
                    if (message.enabled) {

                        const tabId =
                            message.tabId ?? activeTabId;

                        if (tabId == null) {
                            throw new Error(
                                "Open a YouTube video before starting AI Voice."
                            );
                        }

                        // Use original YouTube captions.
                        // Do not start Gnani STT capture.
                        const result =
                            await startYouTubeCaptionVoice(tabId);

                        sendResponse({
                            success: true,
                            voiceEnabled: true,
                            ...result
                        });

                    } else {

                        if (activeTabId != null) {
                            await sendToTab(activeTabId, {
                                type: "STOP_LIVE_VOICE"
                            });
                        }

                        liveVoiceEnabled = false;

                        sendResponse({
                            success: true,
                            voiceEnabled: false
                        });
                    }

                } catch (error) {
                    console.error("AI Voice error:", error);

                    liveVoiceEnabled = false;

                    sendResponse({
                        success: false,
                        message: error.message
                    });
                }
            })();

            return true;
        }


        // ------------------------------------------
        // RECEIVE GNANI TRANSCRIPT EVENTS
        // ------------------------------------------

        if (message?.type === "LIVE_SUBTITLE_EVENT") {

            const event = message.event || {};

            if (
                event.type === "transcript" &&
                event.text?.trim()
            ) {

                segmentQueue.push({
                    event,
                    sessionId
                });

                processNextSegment();

            } else {

                notifyPopup(event);
            }

            return;
        }


        // ------------------------------------------
        // START LIVE SUBTITLES
        // ------------------------------------------

        if (message?.type === "START_LIVE_SUBTITLES") {

            (async () => {
                try {
                    const result = await startLiveCapture(
                        message.tabId,
                        false
                    );

                    sendResponse(result);

                } catch (error) {
                    console.error(
                        "Live listening start failed:",
                        error
                    );

                    sendResponse({
                        success: false,
                        message: error.message
                    });
                }
            })();

            return true;
        }


        // ------------------------------------------
        // STOP SUBTITLES AND VOICE
        // ------------------------------------------

        if (message?.type === "STOP_LIVE_SUBTITLES") {

            sessionId++;

            liveVoiceEnabled = false;

            const tabId = activeTabId;

            segmentQueue.length = 0;
            speakerVoiceAssignments.clear();

            (async () => {
                try {
                    if (tabId != null) {
                        await sendToTab(tabId, {
                            type: "STOP_LIVE_SESSION"
                        });
                    }

                    await chrome.runtime.sendMessage({
                        target: "offscreen",
                        type: "STOP_AUDIO_CAPTURE"
                    });

                } catch (error) {
                    console.warn(
                        "Stop live session warning:",
                        error
                    );

                } finally {
                    activeTabId = null;
                    captureRunning = false;
                    captureStarting = false;
                    processingSegment = false;

                    sendResponse({
                        success: true
                    });
                }
            })();

            return true;
        }

    }
);


// --------------------------------------------------
// START YOUTUBE CAPTION-BASED AI VOICE
// --------------------------------------------------

async function startYouTubeCaptionVoice(tabId) {

    const settings = { ...liveSettings };

    const targetLanguage =
        settings.audioLanguage || "none";

    if (targetLanguage === "none") {
        throw new Error(
            "Please select an AI Voice language."
        );
    }

    const tab = await chrome.tabs.get(tabId);

    if (!tab.url) {
        throw new Error(
            "Could not identify the YouTube video."
        );
    }

    const parsedUrl = new URL(tab.url);

    const videoId =
        parsedUrl.searchParams.get("v") ||
        parsedUrl.pathname.split("/").filter(Boolean).pop();

    if (!videoId) {
        throw new Error(
            "Could not identify the YouTube video ID."
        );
    }

    // Inject content script.
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
    });

    activeTabId = tabId;

    // Do not activate the Gnani transcript voice pipeline.
    liveVoiceEnabled = false;

    // Start a new caption session.
    sessionId++;

    // Stop any previous caption voice.
    await sendToTab(tabId, {
        type: "STOP_LIVE_VOICE"
    });

    // Retrieve original YouTube captions.
    const response = await fetch(
        `${BACKEND_URL}/youtube-captions`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                video_id: videoId
            })
        }
    );

    const result = await readJsonResponse(
        response,
        "YouTube caption retrieval"
    );

    if (
        !Array.isArray(result.captions) ||
        !result.captions.length
    ) {
        throw new Error(
            "No usable YouTube captions were found."
        );
    }

    // Send captions and settings to content.js.
    await sendToTab(tabId, {
        type: "START_CAPTION_VOICE",
        captions: result.captions,
        targetLanguage,
        voice: settings.voice || "Shivani",
        sourceLanguage: result.caption_language
    });

    notifyPopup({
        type: "caption_voice_ready",
        message:
            `Original YouTube captions loaded (${result.caption_language_name}).`
    });

    return {
        success: true,
        captionCount: result.captions.length,
        captionLanguage: result.caption_language
    };
}
