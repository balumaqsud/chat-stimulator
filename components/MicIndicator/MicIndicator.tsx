"use client";

export interface MicIndicatorProps {
  isListening: boolean;
  error: string | null;
  supported: boolean;
}

export function MicIndicator({ isListening, error, supported }: MicIndicatorProps) {
  if (!supported) {
    return (
      <span className="text-amber-500 text-sm" title="Use Chrome or Edge for speech">
        Mic: unsupported
      </span>
    );
  }
  if (error) {
    return (
      <span className="text-rose-500 text-sm" title={error}>
        Mic: error
      </span>
    );
  }
  if (isListening) {
    return (
      <span className="flex items-center gap-1.5 text-emerald-500 text-sm">
        <span
          className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
          aria-hidden
        />
        Listening
      </span>
    );
  }
  return (
    <span className="text-zinc-500 text-sm">
      Mic: off
    </span>
  );
}
