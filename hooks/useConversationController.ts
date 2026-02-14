"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { conversationReducer } from "@/domain/conversation/reducer";
import type {
  ConversationState,
  ConversationUIState,
  ClipId,
} from "@/domain/conversation/types";
import { createSpeechRecognition } from "@/lib/speech/speechRecognition";
import { createSilenceTimer } from "@/lib/speech/silenceTimer";
import { textToResponseClip } from "@/domain/conversation/keywords";

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
  dispatchSpeechResult: (text: string) => void;
  dispatchSpeechError: () => void;
  dispatchMicPermissionDenied: () => void;
  dispatchSilenceTimeout: () => void;
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

  const start = useCallback(() => {
    dispatchState({ type: "SET_ERROR", payload: null });
    dispatchEvent({ type: "START_CLICK" });
  }, [dispatchEvent]);

  const stop = useCallback(() => {
    dispatchEvent({ type: "STOP_CLICK" });
  }, [dispatchEvent]);

  const dispatchSpeechResult = useCallback(
    (text: string) => {
      dispatchEvent({ type: "SPEECH_RESULT", text });
    },
    [dispatchEvent]
  );

  const dispatchSpeechError = useCallback(() => {
    dispatchEvent({ type: "SPEECH_ERROR" });
  }, [dispatchEvent]);

  const dispatchMicPermissionDenied = useCallback(() => {
    dispatchEvent({ type: "MIC_PERMISSION_DENIED" });
  }, [dispatchEvent]);

  const dispatchSilenceTimeout = useCallback(() => {
    dispatchEvent({ type: "SILENCE_TIMEOUT" });
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

  const speechRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof createSilenceTimer> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const callbacksRef = useRef({
    dispatchSpeechResult,
    dispatchSpeechError,
    dispatchMicPermissionDenied,
    setTranscript,
    setError,
    setLastKeywordMatch,
    dispatchSilenceTimeout,
    resetSilenceTimer: () => silenceTimerRef.current?.reset(),
    dispatchStop: () => {
      const result = conversationReducer(stateRef.current.conversationState, { type: "STOP_CLICK" });
      dispatchState({ type: "REDUCER_RESULT", result });
    },
  });
  callbacksRef.current = {
    dispatchSpeechResult,
    dispatchSpeechError,
    dispatchMicPermissionDenied,
    setTranscript,
    setError,
    setLastKeywordMatch,
    dispatchSilenceTimeout,
    resetSilenceTimer: () => silenceTimerRef.current?.reset(),
    dispatchStop: () => {
      const result = conversationReducer(stateRef.current.conversationState, { type: "STOP_CLICK" });
      dispatchState({ type: "REDUCER_RESULT", result });
    },
  };

  useEffect(() => {
    if (!silenceTimerRef.current) {
      silenceTimerRef.current = createSilenceTimer({
        onSilence(secondSilence) {
          if (secondSilence) {
            callbacksRef.current.dispatchStop();
          } else {
            callbacksRef.current.dispatchSilenceTimeout();
          }
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!speechRef.current) {
      speechRef.current = createSpeechRecognition({
        onResult(text, isFinal) {
          callbacksRef.current.setTranscript(text);
          if (!isFinal) {
            callbacksRef.current.resetSilenceTimer();
          }
          if (isFinal && text.trim()) {
            callbacksRef.current.setLastKeywordMatch(textToResponseClip(text));
            callbacksRef.current.dispatchSpeechResult(text);
          }
        },
        onError(message) {
          callbacksRef.current.setError(message);
          if (message.includes("permission denied")) {
            callbacksRef.current.dispatchMicPermissionDenied();
          } else {
            callbacksRef.current.dispatchSpeechError();
          }
        },
        onEnd() {
          // If still in LISTENING, browser ended recognition; could restart with backoff (stretch).
        },
      });
    }
    const speech = speechRef.current;
    const silenceTimer = silenceTimerRef.current;
    if (state.conversationState === "LISTENING") {
      speech.start();
      silenceTimer?.start();
    } else {
      speech.stop();
      silenceTimer?.stop();
    }
    return () => {
      speech.stop();
      silenceTimer?.stop();
    };
  }, [state.conversationState]);

  const uiState: ConversationUIState = {
    state: state.conversationState,
    currentClip: state.currentClip,
    isLooping: state.isLooping,
    transcript: state.transcript,
    lastKeywordMatch: state.lastKeywordMatch,
    error: state.error,
  };

  return {
    uiState,
    actions: { start, stop },
    dispatchVideoEnded,
    dispatchSpeechResult,
    dispatchSpeechError,
    dispatchMicPermissionDenied,
    dispatchSilenceTimeout,
    setTranscript,
    setError,
    setLastKeywordMatch,
  };
}
