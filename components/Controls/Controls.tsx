"use client";

import { MicIndicator } from "@/components/MicIndicator/MicIndicator";
import { Transcript } from "@/components/Transcript/Transcript";
import type { ConversationUIState } from "@/domain/conversation/types";

export interface ControlsProps {
  uiState: ConversationUIState;
  onStart: () => void;
  onStop: () => void;
}

export function Controls({ uiState, onStart, onStop }: ControlsProps) {
  const isIdle = uiState.state === "IDLE";
  const isListening = uiState.state === "LISTENING";
  const speechSupported = uiState.speechSupported !== false;

  return (
    <div className="flex flex-col gap-3">
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

      <Transcript transcript={uiState.transcript} />
    </div>
  );
}
