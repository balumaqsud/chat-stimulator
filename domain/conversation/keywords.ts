import type { ClipId } from "./types";
import { analyzeUserInput } from "./analyze";

/**
 * Normalize user text for keyword matching: lowercase, trim.
 * @deprecated Prefer analyzeUserInput for full analysis; kept for compatibility.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Map recognized text to response clip. Delegates to analyzeUserInput.
 * @deprecated Prefer analyzeUserInput for full analysis; kept for compatibility.
 */
export function textToResponseClip(text: string): ClipId {
  return analyzeUserInput(text).clip;
}

/**
 * Check if the text is a "goodbye" intent.
 * @deprecated Prefer isGoodbyeResult(analyzeUserInput(text)); kept for compatibility.
 */
export function isGoodbyeIntent(text: string): boolean {
  return analyzeUserInput(text).intent === "goodbye";
}
