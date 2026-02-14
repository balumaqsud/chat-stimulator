"use client";

import { useState } from "react";
import type { ConversationUIState } from "@/domain/conversation/types";

export interface DebugPanelProps {
  uiState: ConversationUIState;
  onSimulateVideoEnded?: () => void;
}

export function DebugPanel({ uiState, onSimulateVideoEnded }: DebugPanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 px-2 py-1 rounded bg-zinc-700 text-zinc-400 text-xs hover:bg-zinc-600"
      >
        Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 w-64 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-3 text-xs font-mono">
      <div className="flex justify-between items-center mb-2">
        <span className="text-zinc-400 font-semibold">Debug</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          ×
        </button>
      </div>
      <dl className="space-y-1 text-zinc-300">
        <div>
          <dt className="text-zinc-500">State</dt>
          <dd>{uiState.state}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Response clip</dt>
          <dd>{uiState.currentClip}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Last intent</dt>
          <dd>{uiState.lastKeywordMatch ?? "—"}</dd>
        </div>
        {uiState.responseSummary != null && uiState.responseSummary !== "" && (
          <div>
            <dt className="text-zinc-500">Summary</dt>
            <dd className="break-words">{uiState.responseSummary}</dd>
          </div>
        )}
        {uiState.error && (
          <div>
            <dt className="text-zinc-500">Error</dt>
            <dd className="text-rose-400 break-words">{uiState.error}</dd>
          </div>
        )}
      </dl>
      {onSimulateVideoEnded && (
        <button
          type="button"
          onClick={onSimulateVideoEnded}
          className="mt-2 w-full px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
        >
          Simulate video ended
        </button>
      )}
    </div>
  );
}
