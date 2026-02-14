import type {
  ConversationEvent,
  ConversationState,
  ReducerResult,
  ClipId,
} from "./types";
import { analyzeUserInput } from "./analyze";

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
        return { state, ...getDefaultClipForState(state) };
      }
      const clip =
        event.clip != null
          ? event.clip
          : analyzeUserInput(event.text).clip;
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

    case "SPEECH_RESULT_DURING_PROMPT": {
      if (state !== "RESPONDING") {
        return { state, ...getDefaultClipForState(state) };
      }
      const clipPrompt =
        event.clip != null
          ? event.clip
          : analyzeUserInput(event.text).clip;
      if (clipPrompt === "goodbye") {
        return {
          state: "GOODBYE",
          clip: "goodbye",
          isLooping: false,
        };
      }
      return {
        state: "RESPONDING",
        clip: clipPrompt,
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

    // One listening phase → one prompt → one listening phase (no give up). Goodbye only on user action.
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
