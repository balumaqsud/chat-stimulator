import type { ClipId } from "./types";

/**
 * Normalize user text for keyword matching: lowercase, trim.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Map recognized text to response clip.
 * Rules: goodbye/bye → goodbye; hello/hi → general; weather/today → weather; else → general.
 * Empty or no match → fallback.
 */
export function textToResponseClip(text: string): ClipId {
  const normalized = normalizeText(text);
  if (!normalized) return "fallback";

  if (
    normalized.includes("goodbye") ||
    normalized.includes("bye") ||
    normalized === "by"
  ) {
    return "goodbye";
  }
  if (normalized.includes("hello") || normalized.includes("hi")) {
    return "general_response";
  }
  if (normalized.includes("weather") || normalized.includes("today")) {
    return "weather";
  }

  return "general_response";
}

/**
 * Check if the text is a "goodbye" intent (so we transition to GOODBYE state).
 */
export function isGoodbyeIntent(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return (
    normalized.includes("goodbye") ||
    normalized.includes("bye") ||
    normalized === "by"
  );
}
