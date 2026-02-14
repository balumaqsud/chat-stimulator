import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ClipId } from "@/domain/conversation/types";
import {
  VIDEO_CLIP_DESCRIPTIONS,
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

  const clipList = RESPONSE_CLIP_IDS.map(
    (id) => `- ${id}: ${VIDEO_CLIP_DESCRIPTIONS[id]}`
  ).join("\n");

  const systemPrompt = `You are a classifier. Given the user's spoken message and a list of video clip ids with descriptions, return a JSON object with exactly two keys:
1. "summary": one short sentence (in English) summarizing what the user said.
2. "clip": the id of the single most relevant clip from the list below. You must return only one of these exact ids: ${RESPONSE_CLIP_IDS.join(", ")}.

Available clips (return only the id, e.g. "goodbye" or "general_response"):
${clipList}

If the message is unclear or irrelevant to all options, use "fallback". If the user is saying goodbye or leaving, use "goodbye". Return valid JSON only, no other text.`;

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
