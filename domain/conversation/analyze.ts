import type { ClipId } from "./types";
import { VIDEO_KEYWORDS } from "@/lib/video/keywords";

/**
 * Normalize raw user input: lowercase, trim, optional punctuation strip.
 */
function normalizeInput(rawText: string): string {
  return rawText
    .toLowerCase()
    .trim()
    .replace(/[.!?,;:]+$/g, "");
}

function matchesPhrases(normalized: string, phrases: readonly string[]): boolean {
  for (const phrase of phrases) {
    if (normalized.includes(phrase)) return true;
  }
  return false;
}

export type Intent =
  | "goodbye"
  | "easter_egg"
  | "greeting"
  | "weather"
  | "general"
  | "fallback";

export interface AnalysisResult {
  clip: ClipId;
  intent: Intent;
}

/**
 * Single analysis step: raw user text → response clip and intent.
 * Uses lib/video/keywords as single source of truth. Order: goodbye → easter_egg → weather → greeting → general.
 */
export function analyzeUserInput(rawText: string): AnalysisResult {
  const normalized = normalizeInput(rawText);
  if (!normalized) {
    return { clip: "fallback", intent: "fallback" };
  }

  if (matchesPhrases(normalized, VIDEO_KEYWORDS.goodbye)) {
    return { clip: "goodbye", intent: "goodbye" };
  }
  if (matchesPhrases(normalized, VIDEO_KEYWORDS.easter_egg)) {
    return { clip: "easter_egg", intent: "easter_egg" };
  }
  if (matchesPhrases(normalized, VIDEO_KEYWORDS.weather)) {
    return { clip: "weather", intent: "weather" };
  }
  if (matchesPhrases(normalized, VIDEO_KEYWORDS.greeting)) {
    return { clip: "greeting", intent: "greeting" };
  }
  if (matchesPhrases(normalized, VIDEO_KEYWORDS.general_response)) {
    return { clip: "general_response", intent: "general" };
  }
  if (matchesPhrases(normalized, VIDEO_KEYWORDS.fallback)) {
    return { clip: "fallback", intent: "fallback" };
  }

  return { clip: "fallback", intent: "fallback" };
}

/**
 * Whether the analysis result is a goodbye (state machine transitions to GOODBYE).
 */
export function isGoodbyeResult(result: AnalysisResult): boolean {
  return result.intent === "goodbye";
}
