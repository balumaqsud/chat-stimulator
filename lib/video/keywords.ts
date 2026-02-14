import type { ClipId } from "@/domain/conversation/types";

/** Clip ids that can be chosen from user speech (OpenAI or keyword analysis). Excludes idle, listening, greeting, prompt. */
export const RESPONSE_CLIP_IDS: readonly ClipId[] = [
  "goodbye",
  "easter_egg",
  "weather",
  "general_response",
  "fallback",
] as const;

export function isResponseClipId(id: string): id is ClipId {
  return RESPONSE_CLIP_IDS.includes(id as ClipId);
}

/**
 * Keywords/phrases that trigger each response clip.
 * Idle, listening, greeting, and prompt are state-driven; listed for reference.
 */
export const VIDEO_KEYWORDS: Record<ClipId, readonly string[]> = {
  easter_egg: [
    "applying for job",
    "job position",
    "job",
    "jobs",
    "career",
    "hiring",
    "apply",
    "application",
    "position",
    "vacancy",
    "work here",
    "employment",
    "recruit",
    "interview",
  ],
  fallback: [], // plays when user response was not understandable
  general_response: [
    "hello",
    "hi",
    "hey",
    "how are you",
    "what's up",
    "good morning",
    "good afternoon",
    "good evening",
    "how do you do",
    "nice to meet you",
    "greetings",
    "how's it going",
    "how are you doing",
  ],
  goodbye: [
    "goodbye",
    "see you again",
    "bye-bye",
    "take care",
    "see you later",
    "see you",
    "farewell",
    "have a good one",
    "catch you later",
    "gotta go",
    "i'm leaving",
    "talk later",
    "until next time",
    "take care of yourself",
    "good night",
    "so long",
    "later",
  ],
  greeting: [], // played on start, not from user keywords
  idle: [], // just listening
  listening: [], // just listening, plays when user speaks
  prompt: [], // when user does not speak or does not respond
  weather: [
    "weather",
    "about weather",
    "forecast",
    "temperature",
    "rain",
    "raining",
    "sunny",
    "snow",
    "cold",
    "hot",
    "degrees",
    "climate",
    "outside",
    "today's weather",
  ],
};

/**
 * Short description per clip (for debug, docs, and OpenAI clip selection).
 * Response clips have 1–2 sentences so the model knows when to choose each.
 */
export const VIDEO_CLIP_DESCRIPTIONS: Record<ClipId, string> = {
  easter_egg:
    "User talks about jobs, applying for a job, career, hiring, or a specific job position. Use only for this topic.",
  fallback:
    "Use when the message is unclear, off-topic, or not understandable. Plays a neutral I didn't get that style response.",
  general_response:
    "Default for normal chat: greetings (hello, hi), small talk, how are you, or anything that doesn't fit goodbye, job, or weather. The avatar gives a general friendly reply.",
  goodbye:
    "User is ending the conversation, saying farewell, or leaving. Use for goodbye, bye, see you, take care, have a good one, I'm leaving, etc.",
  greeting: "Played on start",
  idle: "Just listening",
  listening: "Just listening; plays when user speaks",
  prompt: "When user does not speak or does not respond",
  weather:
    "User asks about weather, forecast, temperature, or conditions (sun, rain, cold, hot). Use for any weather-related question or comment.",
};
