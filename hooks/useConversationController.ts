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

const FINALIZATION_MS = 3000;
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
  };
  dispatchVideoEnded: () => void;
  onClipReady: (clipId: ClipId) => void;
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
    case "REDUCER_RESULT": {
      const next = updateFromReducer(
        state,
        action.result.state,
        action.result.clip,
        action.result.isLooping
      );
      const clearedTranscript =
        state.conversationState === "RESPONDING" && action.result.state === "LISTENING"
          ? { ...next, transcript: "" }
          : next;
      return clearedTranscript;
    }
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
    dispatchEvent,
    dispatchState,
  });
  callbacksRef.current = {
    setTranscript,
    setError,
    setLastKeywordMatch,
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
    if (!t) {
      callbacksRef.current.dispatchEvent({ type: "SPEECH_ERROR" });
      return;
    }
    const duringPrompt =
      stateRef.current.conversationState === "RESPONDING" &&
      stateRef.current.currentClip === "prompt";
    if (stateRef.current.conversationState === "RESPONDING" && !duringPrompt) {
      return;
    }
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
      callbacksRef.current.setLastKeywordMatch(result.intent);
      const eventType = duringPrompt ? "SPEECH_RESULT_DURING_PROMPT" : "SPEECH_RESULT";
      callbacksRef.current.dispatchEvent({ type: eventType, text: t });
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
        callbacksRef.current.dispatchState({ type: "SET_RESPONSE_SUMMARY", payload: summary });
        callbacksRef.current.setLastKeywordMatch(clip ?? "general");
        const stillDuringPrompt =
          stateRef.current.conversationState === "RESPONDING" &&
          stateRef.current.currentClip === "prompt";
        const eventType = stillDuringPrompt ? "SPEECH_RESULT_DURING_PROMPT" : "SPEECH_RESULT";
        callbacksRef.current.dispatchEvent({
          type: eventType,
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
        // Intentionally ignore secondSilence: never transition to GOODBYE from silence; loop listen→prompt→listen.
        onSilence(_secondSilence) {
          callbacksRef.current.dispatchEvent({ type: "SILENCE_TIMEOUT" });
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
          callbacksRef.current.setTranscript(utteranceBufferRef.current);
          silenceTimerRef.current?.reset();
          clearFinalizationTimer();
          finalizationTimerRef.current = setTimeout(() => {
            finalizationTimerRef.current = null;
            const buf = utteranceBufferRef.current;
            const interim = interimTextRef.current;
            const full = (buf + (buf && interim ? " " : "") + interim).trim();
            if (full) commitUtterance(full);
          }, FINALIZATION_MS);
        },
        onError(message) {
          speechRef.current?.stop();
          clearFinalizationTimer();
          if (message.includes("permission denied") || message.includes("not-allowed")) {
            callbacksRef.current.dispatchState({ type: "SET_PERMISSION_DENIED", payload: true });
            desiredRunningRef.current = false;
            return;
          }
          if (message.includes("No speech") || message.includes("no-speech")) {
            callbacksRef.current.setError(null);
            callbacksRef.current.dispatchEvent({ type: "SILENCE_TIMEOUT" });
            return;
          }
          if (
            message.includes("Speech not recognized") ||
            message.includes("no-match")
          ) {
            callbacksRef.current.setError(null);
            callbacksRef.current.dispatchEvent({ type: "SPEECH_ERROR" });
            return;
          }
          if (message.includes("aborted")) {
            callbacksRef.current.setError(null);
            const active = stateRef.current.conversationState === "LISTENING";
            if (desiredRunningRef.current && active) {
              const now = Date.now();
              if (now - restartWindowStartRef.current > RESTART_WINDOW_MS) {
                restartWindowStartRef.current = now;
                restartCountRef.current = 0;
              }
              if (restartCountRef.current < RESTART_BUDGET_MAX) {
                restartCountRef.current += 1;
                restartTimeoutRef.current = setTimeout(() => {
                  restartTimeoutRef.current = null;
                  speechRef.current?.start();
                }, RESTART_DELAY_MS);
              } else {
                callbacksRef.current.dispatchEvent({ type: "SILENCE_TIMEOUT" });
              }
            }
            return;
          }
          if (message.includes("network") || message.includes("Network")) {
            callbacksRef.current.setError(null);
            let attempt = 0;
            const tryAgain = () => {
              const active = stateRef.current.conversationState === "LISTENING";
              if (!active || !desiredRunningRef.current) return;
              attempt += 1;
              if (attempt > NETWORK_RETRY_DELAYS.length) {
                callbacksRef.current.dispatchEvent({ type: "SILENCE_TIMEOUT" });
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
          callbacksRef.current.setError(null);
          const active = stateRef.current.conversationState === "LISTENING";
          if (desiredRunningRef.current && active) {
            const now = Date.now();
            if (now - restartWindowStartRef.current > RESTART_WINDOW_MS) {
              restartWindowStartRef.current = now;
              restartCountRef.current = 0;
            }
            if (restartCountRef.current < RESTART_BUDGET_MAX) {
              restartCountRef.current += 1;
              restartTimeoutRef.current = setTimeout(() => {
                restartTimeoutRef.current = null;
                speechRef.current?.start();
              }, RESTART_DELAY_MS);
            } else {
              callbacksRef.current.dispatchEvent({ type: "SILENCE_TIMEOUT" });
            }
          }
        },
        onStart() {},
        onEnd() {
          const active = stateRef.current.conversationState === "LISTENING";
          if (!desiredRunningRef.current || !active) return;
          const now = Date.now();
          if (now - restartWindowStartRef.current > RESTART_WINDOW_MS) {
            restartWindowStartRef.current = now;
            restartCountRef.current = 0;
          }
          if (restartCountRef.current < RESTART_BUDGET_MAX) {
            restartCountRef.current += 1;
            restartTimeoutRef.current = setTimeout(() => {
              restartTimeoutRef.current = null;
              if (
                desiredRunningRef.current &&
                stateRef.current.conversationState === "LISTENING"
              ) {
                speechRef.current?.start();
              }
            }, RESTART_DELAY_MS);
          } else {
            callbacksRef.current.dispatchEvent({ type: "SILENCE_TIMEOUT" });
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

  // Hardening: if we're in LISTENING with listening clip but onClipReady didn't fire (e.g. reuse), start speech/silence timer after a short delay.
  useEffect(() => {
    if (state.conversationState !== "LISTENING" || state.currentClip !== "listening") return;
    if (state.permissionDenied || !speechRef.current?.isSupported()) return;
    const id = setTimeout(() => {
      if (stateRef.current.conversationState !== "LISTENING" || stateRef.current.currentClip !== "listening") return;
      if (stateRef.current.permissionDenied) return;
      if (!desiredRunningRef.current) {
        desiredRunningRef.current = true;
        restartWindowStartRef.current = Date.now();
        restartCountRef.current = 0;
        speechRef.current?.start();
        silenceTimerRef.current?.start();
      }
    }, 150);
    return () => clearTimeout(id);
  }, [state.conversationState, state.currentClip]);

  useEffect(() => {
    const s = state.conversationState;
    if (s === "IDLE" || s === "GOODBYE") {
      desiredRunningRef.current = false;
      utteranceBufferRef.current = "";
      if (restartTimeoutRef.current !== null) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      speechRef.current?.abort();
      silenceTimerRef.current?.stop();
    } else if (s === "RESPONDING") {
      // Keep mic on during prompt so user can respond to "Are you there?"
      if (state.currentClip !== "prompt") {
        desiredRunningRef.current = false;
        utteranceBufferRef.current = "";
        if (restartTimeoutRef.current !== null) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = null;
        }
        speechRef.current?.abort();
        silenceTimerRef.current?.stop();
      }
    }
  }, [state.conversationState, state.currentClip]);

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
    actions: { start, stop },
    dispatchVideoEnded,
    onClipReady,
    setTranscript,
    setError,
    setLastKeywordMatch,
  };
}
