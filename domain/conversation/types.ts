/**
 * Clip identifiers for video playlist.
 * Map to /video_files/{id}.mp4 in lib/video.
 */
export type ClipId =
  | "idle"
  | "greeting"
  | "listening"
  | "weather"
  | "general_response"
  | "goodbye"
  | "fallback"
  | "prompt"
  | "easter_egg";

/** Conversation state (state machine states). */
export type ConversationState =
  | "IDLE"
  | "GREETING"
  | "LISTENING"
  | "RESPONDING"
  | "GOODBYE";

/** Events that drive the conversation state machine. */
export type ConversationEvent =
  | { type: "START_CLICK" }
  | { type: "VIDEO_ENDED" }
  | { type: "SPEECH_RESULT"; text: string; clip?: ClipId; summary?: string }
  | { type: "SPEECH_ERROR" }
  | { type: "MIC_PERMISSION_DENIED" }
  | { type: "SILENCE_TIMEOUT" }
  | { type: "STOP_CLICK" };

/** Result of reducer: next state and which clip to play (if any). */
export interface ReducerResult {
  state: ConversationState;
  /** Clip to play for this transition; undefined = keep current / no change. */
  clip?: ClipId;
  /** Whether the clip is a loop (e.g. idle, listening). */
  isLooping?: boolean;
}

/** UI-facing state exposed by the controller. */
export interface ConversationUIState {
  state: ConversationState;
  transcript: string;
  lastKeywordMatch: string | null;
  error: string | null;
  /** Current clip that should be showing (for VideoStage). */
  currentClip: ClipId;
  isLooping: boolean;
  /** True when getUserMedia was denied; show retry permission + typed fallback. */
  permissionDenied?: boolean;
  /** False when SpeechRecognition is not available; show banner + typed fallback. */
  speechSupported?: boolean;
  /** Summary of user speech from OpenAI (when used); null when not available. */
  responseSummary?: string | null;
}
