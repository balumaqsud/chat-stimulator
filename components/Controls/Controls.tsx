"use client";

import { useState, useEffect } from "react";
import { MicIndicator } from "@/components/MicIndicator/MicIndicator";
import { Transcript } from "@/components/Transcript/Transcript";
import type { ConversationUIState } from "@/domain/conversation/types";

export interface ControlsProps {
  uiState: ConversationUIState;
  onStart: () => void;
  onStop: () => void;
  /** When set, show "Start with typed input" when idle and typed input when in flow. */
  onStartWithTypedFallback?: () => void;
  onTypedSubmit?: (text: string) => void;
}

export function Controls({ uiState, onStart, onStop, onStartWithTypedFallback, onTypedSubmit }: ControlsProps) {
  const [typedInput, setTypedInput] = useState("");
  const isIdle = uiState.state === "IDLE";
  const isListening = uiState.state === "LISTENING";
  const permissionDenied = uiState.permissionDenied === true;
  const speechSupported = uiState.speechSupported !== false;
  const showFallback = permissionDenied || !speechSupported;

  useEffect(() => {
    if (uiState.state === "LISTENING") {
      setTypedInput("");
    }
  }, [uiState.state]);

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = typedInput.trim();
    if (t && onTypedSubmit) {
      onTypedSubmit(t);
      setTypedInput("");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!speechSupported && isIdle && onStartWithTypedFallback && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
          <button
            type="button"
            onClick={onStartWithTypedFallback}
            className="px-3 py-1.5 rounded bg-zinc-600 hover:bg-zinc-500 text-white font-medium"
          >
            Start with typed input
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={!isIdle}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
          >
            Start chat
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={isIdle}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-500 transition-colors"
          >
            End chat
          </button>
        </div>
        <MicIndicator
          isListening={isListening}
          error={uiState.error}
          supported={speechSupported}
        />
      </div>

      {showFallback && !isIdle && onTypedSubmit && (
        <form onSubmit={handleTypedSubmit} className="flex gap-2">
          <input
            type="text"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 min-w-0 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Typed input fallback"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-zinc-600 text-white text-sm font-medium hover:bg-zinc-500 disabled:opacity-50"
            disabled={!typedInput.trim()}
          >
            Send
          </button>
        </form>
      )}

      <Transcript transcript={uiState.transcript} />
    </div>
  );
}
