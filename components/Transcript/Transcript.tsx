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
      className={`min-h-16 max-md:min-h-12 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 max-md:p-2 text-sm max-md:text-xs text-zinc-200 ${className}`}
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
