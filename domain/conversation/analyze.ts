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
    const out = { clip: "goodbye" as const, intent: "goodbye" as const };
    if (typeof fetch !== "undefined") {
      fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "analyze.ts:analyzeUserInput",
          message: "return clip",
          data: { normalized, clip: out.clip },
          timestamp: Date.now(),
          hypothesisId: "H2",
        }),
      }).catch(() => {});
    }
    return out;
  }
  if (matchesPhrases(normalized, VIDEO_KEYWORDS.easter_egg)) {
    const out = { clip: "easter_egg" as const, intent: "easter_egg" as const };
    if (typeof fetch !== "undefined") {
      fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "analyze.ts:analyzeUserInput",
          message: "return clip",
          data: { normalized, clip: out.clip },
          timestamp: Date.now(),
          hypothesisId: "H2",
        }),
      }).catch(() => {});
    }
    return out;
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

  const out = { clip: "general_response" as const, intent: "general" as const };
  if (typeof fetch !== "undefined") {
    fetch("http://127.0.0.1:7244/ingest/667d0e13-f04c-424e-8066-86cf988ff92b", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "analyze.ts:analyzeUserInput",
        message: "return clip (default general)",
        data: { normalized, clip: out.clip },
        timestamp: Date.now(),
        hypothesisId: "H2",
      }),
    }).catch(() => {});
  }
  return out;
}

/**
 * Whether the analysis result is a goodbye (state machine transitions to GOODBYE).
 */
export function isGoodbyeResult(result: AnalysisResult): boolean {
  return result.intent === "goodbye";
}
