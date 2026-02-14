"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { conversationReducer } from "@/domain/conversation/reducer";
import type {
  ConversationState,
  ConversationUIState,
  ClipId,
} from "@/domain/conversation/types";
import { createSpeechRecognizer, isSpeechRecognitionSupported } from "@/lib/speech/speechRecognition";
import { createSilenceTimer } from "@/lib/speech/silenceTimer";
import { analyzeUserInput } from "@/domain/conversation/analyze";
import { isResponseClipId } from "@/lib/video/keywords";

const FINALIZATION_MS = 1000;
const RESTART_DELAY_MS = 300;
const RESTART_BUDGET_MAX = 4;
const RESTART_WINDOW_MS = 15000;
const NETWORK_RETRY_DELAYS = [500, 1000, 2000];

interface ControllerState extends ConversationUIState {
  conversationState: ConversationState;
}

const initialState: ControllerState = {
  conversationState: "IDLE",
  state: "IDLE",
  currentClip: "idle",
  isLooping: true,
  transcript: "",
  lastKeywordMatch: null,
  error: null,
  permissionDenied: false,
  speechSupported: true,
  responseSummary: null,
};

function updateFromReducer(
  prev: ControllerState,
  state: ConversationState,
  clip?: ClipId,
  isLooping?: boolean
): ControllerState {
  return {
    ...prev,
    conversationState: state,
    state,
    currentClip: clip ?? prev.currentClip,
    isLooping: isLooping ?? prev.isLooping,
  };
}

export interface UseConversationControllerReturn {
  uiState: ConversationUIState;
  actions: {
    start: () => void;
    stop: () => void;
    /** Start conversation without mic (typed input only). Use when permission denied or unsupported. */
    startWithTypedFallback: () => void;
  };
  dispatchVideoEnded: () => void;
  onClipReady: (clipId: ClipId) => void;
  dispatchSpeechResult: (text: string) => void;
  setTranscript: (text: string) => void;
  setError: (error: string | null) => void;
  setLastKeywordMatch: (match: string | null) => void;
}

function controllerReducer(
  state: ControllerState,
  action:
    | { type: "REDUCER_RESULT"; result: ReturnType<typeof conversationReducer> }
    | { type: "SET_TRANSCRIPT"; payload: string }
    | { type: "SET_ERROR"; payload: string | null }
    | { type: "SET_LAST_KEYWORD"; payload: string | null }
    | { type: "SET_PERMISSION_DENIED"; payload: boolean }
    | { type: "SET_SPEECH_SUPPORTED"; payload: boolean }
    | { type: "SET_RESPONSE_SUMMARY"; payload: string | null }
): ControllerState {
  switch (action.type) {
    case "REDUCER_RESULT":
      return updateFromReducer(
        state,
        action.result.state,
        action.result.clip,
        action.result.isLooping
      );
    case "SET_TRANSCRIPT":
      return { ...state, transcript: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_LAST_KEYWORD":
      return { ...state, lastKeywordMatch: action.payload };
    case "SET_PERMISSION_DENIED":
      return { ...state, permissionDenied: action.payload };
    case "SET_SPEECH_SUPPORTED":
      return { ...state, speechSupported: action.payload };
    case "SET_RESPONSE_SUMMARY":
      return { ...state, responseSummary: action.payload };
    default:
      return state;
  }
}

export function useConversationController(): UseConversationControllerReturn {
  const [state, dispatchState] = useReducer(controllerReducer, initialState);

  const dispatchEvent = useCallback(
    (event: Parameters<typeof conversationReducer>[1]) => {
      const result = conversationReducer(state.conversationState, event);
      dispatchState({ type: "REDUCER_RESULT", result });
    },
    [state.conversationState]
  );

  const dispatchVideoEnded = useCallback(() => {
    dispatchEvent({ type: "VIDEO_ENDED" });
  }, [dispatchEvent]);

  const start = useCallback(async () => {
    dispatchState({ type: "SET_ERROR", payload: null });
    dispatchState({ type: "SET_PERMISSION_DENIED", payload: false });

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      dispatchState({ type: "SET_PERMISSION_DENIED", payload: true });
      dispatchState({ type: "SET_ERROR", payload: "Microphone not available." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      dispatchEvent({ type: "START_CLICK" });
    } catch {
      dispatchState({ type: "SET_PERMISSION_DENIED", payload: true });
      dispatchState({
        type: "SET_ERROR",
        payload: "Microphone permission is required. Please allow mic and retry.",
      });
    }
  }, [dispatchEvent]);

  const stop = useCallback(() => {
    dispatchEvent({ type: "STOP_CLICK" });
  }, [dispatchEvent]);

  const startWithTypedFallback = useCallback(() => {
    dispatchState({ type: "SET_ERROR", payload: null });
    dispatchEvent({ type: "START_CLICK" });
  }, [dispatchEvent]);

  const dispatchSpeechResult = useCallback(
    (text: string) => {
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "useConversationController.ts:dispatchSpeechResult",
          message: "typed submit (no API)",
          data: { text },
          timestamp: Date.now(),
          hypothesisId: "H1",
        }),
      }).catch(() => {});
      // #endregion
      dispatchEvent({ type: "SPEECH_RESULT", text });
    },
    [dispatchEvent]
  );

  const setTranscript = useCallback((text: string) => {
    dispatchState({ type: "SET_TRANSCRIPT", payload: text });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatchState({ type: "SET_ERROR", payload: error });
  }, []);

  const setLastKeywordMatch = useCallback((match: string | null) => {
    dispatchState({ type: "SET_LAST_KEYWORD", payload: match });
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const speechRef = useRef<ReturnType<typeof createSpeechRecognizer> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof createSilenceTimer> | null>(null);
  const desiredRunningRef = useRef(false);
  const restartCountRef = useRef(0);
  const restartWindowStartRef = useRef(0);
  const finalizationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimTextRef = useRef("");
  const utteranceBufferRef = useRef("");
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callbacksRef = useRef({
    setTranscript,
    setError,
    setLastKeywordMatch,
    dispatchSpeechResult,
    dispatchEvent,
    dispatchState,
  });
  callbacksRef.current = {
    setTranscript,
    setError,
    setLastKeywordMatch,
    dispatchSpeechResult,
    dispatchEvent,
    dispatchState,
  };

  const clearFinalizationTimer = useCallback(() => {
    if (finalizationTimerRef.current !== null) {
      clearTimeout(finalizationTimerRef.current);
      finalizationTimerRef.current = null;
    }
  }, []);

  const useOpenAIAnalysis =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_OPENAI_ANALYSIS === "true";

  const commitUtterance = useCallback((fullText: string) => {
    const t = fullText.trim();
    if (!t) return;
    if (stateRef.current.conversationState === "RESPONDING") {
      return;
    }
    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "useConversationController.ts:commitUtterance",
        message: "commitUtterance entry",
        data: { text: t, useOpenAIAnalysis },
        timestamp: Date.now(),
        hypothesisId: "H4",
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
    if (finalizationTimerRef.current !== null) {
      clearTimeout(finalizationTimerRef.current);
      finalizationTimerRef.current = null;
    }
    interimTextRef.current = "";
    utteranceBufferRef.current = "";
    speechRef.current?.stop();

    const applyFallback = () => {
      callbacksRef.current.dispatchState({ type: "SET_RESPONSE_SUMMARY", payload: null });
      const result = analyzeUserInput(t);
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "useConversationController.ts:applyFallback",
          message: "fallback clip from analyzeUserInput",
          data: { text: t, clip: result.clip, intent: result.intent },
          timestamp: Date.now(),
          hypothesisId: "H4",
        }),
      }).catch(() => {});
      // #endregion
      callbacksRef.current.setLastKeywordMatch(result.intent);
      callbacksRef.current.dispatchEvent({ type: "SPEECH_RESULT", text: t });
    };

    if (!useOpenAIAnalysis) {
      applyFallback();
      return;
    }

    fetch("/api/analyze-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Analysis failed");
        return res.json();
      })
      .then((data: { summary?: string; clip?: string }) => {
        const summary = typeof data.summary === "string" ? data.summary : null;
        const clip =
          typeof data.clip === "string" && isResponseClipId(data.clip) ? data.clip : undefined;
        // #region agent log
        fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "useConversationController.ts:API success",
            message: "API returned clip",
            data: { text: t, apiClip: data.clip, validatedClip: clip },
            timestamp: Date.now(),
            hypothesisId: "H4",
          }),
        }).catch(() => {});
        // #endregion
        callbacksRef.current.dispatchState({ type: "SET_RESPONSE_SUMMARY", payload: summary });
        callbacksRef.current.setLastKeywordMatch(clip ?? "general");
        callbacksRef.current.dispatchEvent({
          type: "SPEECH_RESULT",
          text: t,
          clip: clip as ClipId | undefined,
        });
      })
      .catch(() => {
        applyFallback();
      });
  }, [useOpenAIAnalysis]);

  useEffect(() => {
    dispatchState({ type: "SET_SPEECH_SUPPORTED", payload: isSpeechRecognitionSupported() });
  }, []);

  useEffect(() => {
    if (!silenceTimerRef.current) {
      silenceTimerRef.current = createSilenceTimer({
        onSilence(secondSilence) {
          if (secondSilence) {
            const result = conversationReducer(stateRef.current.conversationState, { type: "STOP_CLICK" });
            callbacksRef.current.dispatchState({ type: "REDUCER_RESULT", result });
          } else {
            callbacksRef.current.dispatchEvent({ type: "SILENCE_TIMEOUT" });
          }
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!speechRef.current) {
      speechRef.current = createSpeechRecognizer({
        onInterim(text) {
          interimTextRef.current = text;
          callbacksRef.current.setTranscript(text);
          silenceTimerRef.current?.reset();
          clearFinalizationTimer();
          finalizationTimerRef.current = setTimeout(() => {
            finalizationTimerRef.current = null;
            const buffer = utteranceBufferRef.current;
            const interim = interimTextRef.current;
            const full = (buffer + (buffer && interim ? " " : "") + interim).trim();
            if (full) commitUtterance(full);
          }, FINALIZATION_MS);
        },
        onFinal(segment) {
          const buffer = utteranceBufferRef.current;
          utteranceBufferRef.current = (buffer + (buffer ? " " : "") + segment).trim();
          const full = utteranceBufferRef.current;
          if (full) commitUtterance(full);
        },
        onError(message) {
          speechRef.current?.stop();
          clearFinalizationTimer();
          if (message.includes("permission denied") || message.includes("not-allowed")) {
            callbacksRef.current.dispatchState({ type: "SET_PERMISSION_DENIED", payload: true });
            callbacksRef.current.setError(message);
            desiredRunningRef.current = false;
            return;
          }
          if (message.includes("No speech") || message.includes("no-speech")) {
            callbacksRef.current.setError(null);
            callbacksRef.current.dispatchEvent({ type: "SPEECH_ERROR" });
            if (desiredRunningRef.current && stateRef.current.conversationState === "LISTENING") {
              const now = Date.now();
              if (now - restartWindowStartRef.current < RESTART_WINDOW_MS && restartCountRef.current < RESTART_BUDGET_MAX) {
                restartCountRef.current += 1;
                restartTimeoutRef.current = setTimeout(() => {
                  restartTimeoutRef.current = null;
                  speechRef.current?.start();
                }, RESTART_DELAY_MS);
              }
            }
            return;
          }
          if (message.includes("network") || message.includes("Network")) {
            callbacksRef.current.setError("Speech service issue. Retrying…");
            let attempt = 0;
            const tryAgain = () => {
              if (stateRef.current.conversationState !== "LISTENING" || !desiredRunningRef.current) return;
              attempt += 1;
              if (attempt > NETWORK_RETRY_DELAYS.length) {
                callbacksRef.current.setError("Speech service unavailable. Use typed input.");
                callbacksRef.current.dispatchEvent({ type: "SPEECH_ERROR" });
                return;
              }
              const delay = NETWORK_RETRY_DELAYS[attempt - 1] ?? 2000;
              setTimeout(() => {
                speechRef.current?.start();
              }, delay);
            };
            setTimeout(tryAgain, NETWORK_RETRY_DELAYS[0]);
            return;
          }
          callbacksRef.current.setError(message);
          callbacksRef.current.dispatchEvent({ type: "SPEECH_ERROR" });
        },
        onStart() {},
        onEnd() {
          if (!desiredRunningRef.current || stateRef.current.conversationState !== "LISTENING") return;
          const now = Date.now();
          if (now - restartWindowStartRef.current > RESTART_WINDOW_MS) {
            restartWindowStartRef.current = now;
            restartCountRef.current = 0;
          }
          if (restartCountRef.current < RESTART_BUDGET_MAX) {
            restartCountRef.current += 1;
            restartTimeoutRef.current = setTimeout(() => {
              restartTimeoutRef.current = null;
              if (desiredRunningRef.current && stateRef.current.conversationState === "LISTENING") {
                speechRef.current?.start();
              }
            }, RESTART_DELAY_MS);
          } else {
            callbacksRef.current.setError("Speech stopped unexpectedly. Try again or use typed input.");
          }
        },
      });
    }
  }, [commitUtterance]);

  const onClipReady = useCallback((clipId: ClipId) => {
    if (clipId !== "listening") return;
    if (stateRef.current.conversationState !== "LISTENING") return;
    if (stateRef.current.permissionDenied) return;
    if (!speechRef.current?.isSupported()) return;
    desiredRunningRef.current = true;
    restartWindowStartRef.current = Date.now();
    restartCountRef.current = 0;
    speechRef.current.start();
    silenceTimerRef.current?.start();
  }, []);

  useEffect(() => {
    if (state.conversationState !== "LISTENING") {
      desiredRunningRef.current = false;
      utteranceBufferRef.current = "";
      if (restartTimeoutRef.current !== null) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      speechRef.current?.abort();
      silenceTimerRef.current?.stop();
    }
  }, [state.conversationState]);

  const uiState: ConversationUIState = {
    state: state.conversationState,
    currentClip: state.currentClip,
    isLooping: state.isLooping,
    transcript: state.transcript,
    lastKeywordMatch: state.lastKeywordMatch,
    error: state.error,
    permissionDenied: state.permissionDenied,
    speechSupported: state.speechSupported,
    responseSummary: state.responseSummary ?? null,
  };

  return {
    uiState,
    actions: { start, stop, startWithTypedFallback },
    dispatchVideoEnded,
    onClipReady,
    dispatchSpeechResult,
    setTranscript,
    setError,
    setLastKeywordMatch,
  };
}
