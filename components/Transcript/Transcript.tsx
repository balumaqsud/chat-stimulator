"use client";

export interface TranscriptProps {
  transcript: string;
  placeholder?: string;
  className?: string;
}

export function Transcript({
  transcript,
  placeholder = "Say something…",
  className = "",
}: TranscriptProps) {
  return (
    <div
      className={`min-h-[4rem] rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200 ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {transcript ? (
        <p className="whitespace-pre-wrap">{transcript}</p>
      ) : (
        <p className="text-zinc-500 italic">{placeholder}</p>
      )}
    </div>
  );
}
