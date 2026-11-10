
(() => {
  if (window.__youmentorLiveSubtitleInstalled) return;
  window.__youmentorLiveSubtitleInstalled = true;

  let overlay = null;

  // Existing live-subtitle audio queue
  let audioQueue = [];
  let playing = false;
  let currentAudio = null;
  let mutedVideoState = null;

  // New YouTube-caption voice state
  let captionRunId = 0;
  let captionVoiceAudio = null;
  let captionVoiceActive = false;

  function findVideoContainer() {
    return document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-container") ||
      document.querySelector("video")?.parentElement;
  }

  function getVideo() {
    return document.querySelector("video");
  }

  function ensureOverlay() {
    const container = findVideoContainer();
    if (!container) return null;

    if (!overlay || !overlay.isConnected) {
      overlay = document.getElementById(
        "youmentor-live-subtitle-overlay"
      );

      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "youmentor-live-subtitle-overlay";

        Object.assign(overlay.style, {
          position: "absolute",
          left: "5%",
          right: "5%",
          bottom: "9%",
          zIndex: "999999",
          color: "#fff",
          textAlign: "center",
          fontSize: "clamp(18px, 2.4vw, 30px)",
          fontWeight: "700",
          lineHeight: "1.35",
          textShadow: "0 2px 4px #000, 2px 2px 5px #000",
          background: "rgba(0,0,0,.48)",
          borderRadius: "8px",
          padding: "8px 12px",
          pointerEvents: "none",
          whiteSpace: "pre-wrap",
          display: "none"
        });
      }

      if (getComputedStyle(container).position === "static") {
        container.style.position = "relative";
      }

      container.appendChild(overlay);
    }

    return overlay;
  }

  function displaySubtitle(text, duration = 6500) {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;

    const node = ensureOverlay();
    if (!node) return;

    node.textContent = cleanText;
    node.style.display = "block";

    clearTimeout(node.__hideTimer);

    node.__hideTimer = setTimeout(() => {
      node.style.display = "none";
    }, duration);
  }

  // Existing live-subtitle audio functions

  function muteOriginalVideo() {
    const video = getVideo();
    if (!video) return;

    if (mutedVideoState?.video === video) return;

    restoreOriginalVideo();

    mutedVideoState = {
      video,
      muted: video.muted,
      volume: video.volume
    };

    video.muted = true;
  }

  function restoreOriginalVideo() {
    if (!mutedVideoState) return;

    const { video, muted, volume } = mutedVideoState;

    if (video) {
      video.volume = volume;
      video.muted = muted;
    }

    mutedVideoState = null;
  }

  function playNextAudio() {
    if (playing) return;

    if (!audioQueue.length) {
      restoreOriginalVideo();
      return;
    }

    playing = true;
    muteOriginalVideo();

    const item = audioQueue.shift();
    const audio = new Audio(item.url);
    currentAudio = audio;

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;

      URL.revokeObjectURL(item.url);

      if (currentAudio === audio) {
        currentAudio = null;
      }

      playing = false;

      if (audioQueue.length) {
        playNextAudio();
      } else {
        restoreOriginalVideo();
      }
    };

    audio.onended = finish;
    audio.onerror = finish;

    audio.play().catch(error => {
      console.error("YouMentor AI voice playback failed:", error);
      finish();
    });
  }

  function enqueueAudio(base64, mime) {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: mime || "audio/wav"
        })
      );

      audioQueue.push({ url });
      playNextAudio();

    } catch (error) {
      console.error("Could not decode AI voice audio:", error);
    }
  }

  function stopVoice() {
    for (const item of audioQueue) {
      URL.revokeObjectURL(item.url);
    }

    audioQueue = [];

    if (currentAudio) {
      const audio = currentAudio;
      currentAudio = null;

      const url = audio.src;

      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }

    playing = false;
    restoreOriginalVideo();
  }

  // New caption-based AI Voice functions

  function waitForVideoTime(video, targetTime, runId) {
    return new Promise(resolve => {
      const check = () => {
        if (
          runId !== captionRunId ||
          !captionVoiceActive
        ) {
          resolve(false);
          return;
        }

        if (!video || !video.isConnected) {
          resolve(false);
          return;
        }

        if (video.currentTime >= targetTime) {
          resolve(true);
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  function requestCaptionSpeech(caption, settings, runId) {
    return new Promise(resolve => {
      if (runId !== captionRunId) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "CAPTION_VOICE_REQUEST",
          captionText: caption.text,
          targetLanguage: settings.targetLanguage,
          voice: settings.voice,
          sourceLanguage: settings.sourceLanguage
        },
        response => {
          if (chrome.runtime.lastError) {
            console.error(
              "Caption voice request failed:",
              chrome.runtime.lastError.message
            );
            resolve(null);
            return;
          }

          if (!response?.success || !response.audioBase64) {
            console.error(
              "Caption voice error:",
              response?.message || "No audio returned."
            );
            resolve(null);
            return;
          }

          resolve(response);
        }
      );
    });
  }

  function createAudioUrl(base64, mime) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return URL.createObjectURL(
      new Blob([bytes], {
        type: mime || "audio/wav"
      })
    );
  }

  function playCaptionAudio(url, video, shouldResume, runId) {
    return new Promise(resolve => {
      if (
        runId !== captionRunId ||
        !captionVoiceActive
      ) {
        URL.revokeObjectURL(url);
        resolve(false);
        return;
      }

      const audio = new Audio(url);
      captionVoiceAudio = audio;

      let finished = false;

      const finish = success => {
        if (finished) return;
        finished = true;

        audio.onended = null;
        audio.onerror = null;

        URL.revokeObjectURL(url);

        if (captionVoiceAudio === audio) {
          captionVoiceAudio = null;
        }

        if (
          shouldResume &&
          video &&
          video.isConnected &&
          captionVoiceActive &&
          runId === captionRunId
        ) {
          video.play().catch(error => {
            console.warn(
              "Could not resume YouTube video:",
              error
            );
          });
        }

        resolve(success);
      };

      audio.onended = () => finish(true);
      audio.onerror = () => {
        console.error("Caption voice audio playback failed.");
        finish(false);
      };

      audio.play().catch(error => {
        console.error(
          "Caption voice playback could not start:",
          error
        );
        finish(false);
      });
    });
  }

  async function startCaptionVoice(message) {
    stopCaptionVoice();

    const runId = captionRunId;
    const video = getVideo();

    if (!video) {
      console.error("YouTube video element was not found.");
      return;
    }

    if (
      !Array.isArray(message.captions) ||
      !message.captions.length
    ) {
      console.error("No YouTube captions were supplied.");
      return;
    }

    const settings = {
      targetLanguage: message.targetLanguage,
      voice: message.voice || "Shivani",
      sourceLanguage: message.sourceLanguage || ""
    };

    captionVoiceActive = true;

    const captions = [...message.captions]
      .filter(item =>
        Number.isFinite(Number(item.start)) &&
        String(item.text || "").trim()
      )
      .sort((a, b) => Number(a.start) - Number(b.start));

    for (const caption of captions) {
      if (
        runId !== captionRunId ||
        !captionVoiceActive
      ) {
        break;
      }

      const reached = await waitForVideoTime(
        video,
        Number(caption.start),
        runId
      );

      if (!reached) break;

      const wasPlaying = !video.paused && !video.ended;

      // Pause before requesting translation and TTS.
      if (wasPlaying) {
        video.pause();
      }

      const response = await requestCaptionSpeech(
        caption,
        settings,
        runId
      );

      if (
        runId !== captionRunId ||
        !captionVoiceActive
      ) {
        break;
      }

      if (!response) {
        // Do not silently skip failed captions.
        console.error(
          "Could not generate speech for caption:",
          caption.text
        );

        if (wasPlaying) {
          video.play().catch(() => {});
        }

        break;
      }

      displaySubtitle(
        response.translatedText || caption.text,
        10000
      );

      let audioUrl;

      try {
        audioUrl = createAudioUrl(
          response.audioBase64,
          response.audioMime
        );
      } catch (error) {
        console.error("Could not decode caption audio:", error);

        if (wasPlaying) {
          video.play().catch(() => {});
        }

        break;
      }

      await playCaptionAudio(
        audioUrl,
        video,
        wasPlaying,
        runId
      );
    }

    if (runId === captionRunId) {
      captionVoiceActive = false;
      hideSubtitles();
    }
  }

  function stopCaptionVoice() {
    captionRunId++;
    captionVoiceActive = false;

    if (captionVoiceAudio) {
      const audio = captionVoiceAudio;
      captionVoiceAudio = null;

      const url = audio.src;

      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }
  }

  function hideSubtitles() {
    if (!overlay) {
      overlay = document.getElementById(
        "youmentor-live-subtitle-overlay"
      );
    }

    if (overlay) {
      clearTimeout(overlay.__hideTimer);
      overlay.textContent = "";
      overlay.style.display = "none";
    }
  }

  // Message handling

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "DISPLAY_LIVE_SUBTITLE") {
      const text = String(message.text || "").trim();

      if (text) {
        displaySubtitle(text);
      }

      if (message.audioBase64) {
        enqueueAudio(
          message.audioBase64,
          message.audioMime
        );
      }

      return;
    }

    if (message?.type === "START_CAPTION_VOICE") {
      startCaptionVoice(message);
      return;
    }

    if (message?.type === "STOP_LIVE_VOICE") {
      stopCaptionVoice();
      stopVoice();
      return;
    }

    if (message?.type === "STOP_LIVE_SESSION") {
      stopCaptionVoice();
      stopVoice();
      hideSubtitles();
      return;
    }

    if (message?.type === "HIDE_LIVE_SUBTITLES") {
      hideSubtitles();
      return;
    }

    if (message?.type === "TEST_SUBTITLE_OVERLAY") {
      displaySubtitle(
        message.text ||
          "YouMentor AI live subtitles are working!",
        5000
      );
    }
  });
})();
