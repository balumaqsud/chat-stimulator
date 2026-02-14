import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ClipId } from "@/domain/conversation/types";
import {
  VIDEO_CLIP_DESCRIPTIONS,
  VIDEO_KEYWORDS,
  RESPONSE_CLIP_IDS,
  isResponseClipId,
} from "@/lib/video/keywords";

const MAX_TEXT_LENGTH = 2000;
const OPENAI_TIMEOUT_MS = 8000;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "OpenAI not configured" },
      { status: 503 }
    );
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  if (!rawText) {
    return NextResponse.json(
      { error: "Missing or empty text" },
      { status: 400 }
    );
  }

  const text = rawText.slice(0, MAX_TEXT_LENGTH);

  const clipList = RESPONSE_CLIP_IDS.map((id) => {
    const desc = VIDEO_CLIP_DESCRIPTIONS[id];
    const phrases = VIDEO_KEYWORDS[id];
    const phraseList =
      phrases.length > 0
        ? ` Example phrases: ${phrases.slice(0, 20).join(", ")}.`
        : "";
    return `- ${id}: ${desc}${phraseList}`;
  }).join("\n");

  const systemPrompt = `You are a classifier that maps the user's spoken message to exactly one response video clip.

Return a JSON object with exactly two keys: "summary" (one short sentence in English summarizing what the user said) and "clip" (one of the clip ids below). The "clip" value must be exactly one of: ${RESPONSE_CLIP_IDS.join(", ")}.

Decision rules (prefer the most specific match; use fallback only when nothing else fits):
- goodbye: User is ending the conversation, saying farewell, or leaving. Choose over any other option when the intent is clearly goodbye.
- easter_egg: User talks about jobs, applying, career, hiring, position, interview. Choose only when the main topic is work/job/career.
- weather: User asks or talks about weather, forecast, temperature, rain, sun, etc. Choose for any weather-related message.
- greeting: User is greeting or saying hello. Use for hello, hi, hey, good morning, etc.
- general_response: Small talk, how are you, or general chat that does not fit goodbye, job, weather, or greeting.
- fallback: Use when the message is unclear, unintelligible, off-topic, repetitive filler, random nonsense, or not understandable. This includes: "Blah blah", "La la la", "meow meow", "Virtual person Blah blah meow meow", "asdfghjkl", repeated nonsense, gibberish, or any input that does not express a clear intent. Do not use for normal greetings or vague but understandable chat.

Priority: goodbye > easter_egg > weather > greeting > general_response. Use fallback only when nothing else fits.

Examples: "Bye, see you tomorrow" -> goodbye. "What's the weather like?" -> weather. "I'd like to apply for the job" -> easter_egg. "Hello!" or "Hi there!" -> greeting. "How are you?" -> general_response. "Blah blah blah", "La la la", "Virtual person Blah blah meow meow", "asdfghjkl", repeated nonsense -> fallback.

Available clips:
${clipList}

Return valid JSON only, no other text.`;

  const userPrompt = `User said: ${text}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 150,
      },
      { timeout: OPENAI_TIMEOUT_MS }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Empty response from OpenAI" },
        { status: 502 }
      );
    }

    let parsed: { summary?: string; clip?: string };
    try {
      parsed = JSON.parse(content) as { summary?: string; clip?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from OpenAI" },
        { status: 502 }
      );
    }

    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "No summary";
    let clip: ClipId = "general_response";
    if (typeof parsed.clip === "string" && isResponseClipId(parsed.clip)) {
      clip = parsed.clip;
    }

    return NextResponse.json({ summary, clip });
  } catch (err) {
    console.error("OpenAI analyze-speech error:", err);
    return NextResponse.json(
      { error: "Speech analysis failed" },
      { status: 502 }
    );
  }
}
