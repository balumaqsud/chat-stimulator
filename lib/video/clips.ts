import type { ClipId } from "@/domain/conversation/types";

const VIDEO_BASE = "/videos";

/**
 * Map clip id to public URL. Files live in public/videos/*.mp4
 */
export function getClipSrc(clipId: ClipId): string {
  return `${VIDEO_BASE}/${clipId}.mp4`;
}

/** All clip ids that should be preloaded on startup. */
export const PRELOAD_CLIPS: ClipId[] = [
  "idle",
  "greeting",
  "listening",
  "weather",
  "general_response",
  "goodbye",
  "fallback",
  "prompt",
];
