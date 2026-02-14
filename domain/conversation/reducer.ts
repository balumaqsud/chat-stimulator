import type {
  ConversationEvent,
  ConversationState,
  ReducerResult,
  ClipId,
} from "./types";
import { analyzeUserInput, isGoodbyeResult } from "./analyze";

/**
 * State → default clip for that state (looping where applicable).
 */
function getDefaultClipForState(state: ConversationState): {
  clip: ClipId;
  isLooping: boolean;
} {
  switch (state) {
    case "IDLE":
      return { clip: "idle", isLooping: true };
    case "GREETING":
      return { clip: "greeting", isLooping: false };
    case "LISTENING":
      return { clip: "listening", isLooping: true };
    case "RESPONDING":
      return { clip: "general_response", isLooping: false };
    case "GOODBYE":
      return { clip: "goodbye", isLooping: false };
    default:
      return { clip: "idle", isLooping: true };
  }
}

/**
 * Pure transition function. No side effects.
 * Returns next state and which clip to play (and whether it loops).
 */
export function conversationReducer(
  state: ConversationState,
  event: ConversationEvent
): ReducerResult {
  switch (event.type) {
    case "START_CLICK":
      if (state === "IDLE") {
        return {
          state: "GREETING",
          clip: "greeting",
          isLooping: false,
        };
      }
      return { state, ...getDefaultClipForState(state) };

    case "VIDEO_ENDED":
      if (state === "GREETING") {
        return {
          state: "LISTENING",
          clip: "listening",
          isLooping: true,
        };
      }
      if (state === "RESPONDING") {
        return {
          state: "LISTENING",
          clip: "listening",
          isLooping: true,
        };
      }
      if (state === "GOODBYE") {
        return {
          state: "IDLE",
          clip: "idle",
          isLooping: true,
        };
      }
      return { state, ...getDefaultClipForState(state) };

    case "SPEECH_RESULT": {
      if (state !== "LISTENING") {
        if (typeof fetch !== "undefined") {
          fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "reducer.ts:SPEECH_RESULT",
              message: "state not LISTENING",
              data: { state, text: event.text, eventClip: event.clip },
              timestamp: Date.now(),
              hypothesisId: "H3",
            }),
          }).catch(() => {});
        }
        return { state, ...getDefaultClipForState(state) };
      }
      const clip =
        event.clip != null
          ? event.clip
          : analyzeUserInput(event.text).clip;
      if (typeof fetch !== "undefined") {
        fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "reducer.ts:SPEECH_RESULT",
            message: "computed clip",
            data: { state, text: event.text, eventClip: event.clip, computedClip: clip },
            timestamp: Date.now(),
            hypothesisId: "H3",
          }),
        }).catch(() => {});
      }
      if (clip === "goodbye") {
        return {
          state: "GOODBYE",
          clip: "goodbye",
          isLooping: false,
        };
      }
      return {
        state: "RESPONDING",
        clip,
        isLooping: false,
      };
    }

    case "SPEECH_ERROR":
      if (state === "LISTENING") {
        return {
          state: "RESPONDING",
          clip: "fallback",
          isLooping: false,
        };
      }
      return { state, ...getDefaultClipForState(state) };

    case "MIC_PERMISSION_DENIED":
      return { state, ...getDefaultClipForState(state) };

    case "SILENCE_TIMEOUT":
      if (state === "LISTENING") {
        return {
          state: "RESPONDING",
          clip: "prompt",
          isLooping: false,
        };
      }
      return { state, ...getDefaultClipForState(state) };

    case "STOP_CLICK":
      return {
        state: "GOODBYE",
        clip: "goodbye",
        isLooping: false,
      };

    default:
      return { state, ...getDefaultClipForState(state) };
  }
}
