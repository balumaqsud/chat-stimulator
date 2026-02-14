"use client";

import { VideoStage } from "@/components/VideoStage/VideoStage";
import { Controls } from "@/components/Controls/Controls";
import { DebugPanel } from "@/components/DebugPanel/DebugPanel";
import type { ClipId } from "@/domain/conversation/types";
import { useConversationController } from "@/hooks/useConversationController";
import { getClipSrc } from "@/lib/video/clips";

export default function Home() {
  const { uiState, actions, dispatchVideoEnded, onClipReady, setError } =
    useConversationController();

  const handleVideoLoadError = (clip: ClipId, _err: unknown) => {
    if (uiState.state === "IDLE") {
      setError(null);
      return;
    }
    setError(`Missing or failed to load video: ${getClipSrc(clip)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <header className="p-4 max-md:px-3 max-md:py-3 border-b border-zinc-800">
        <h1 className="text-xl max-md:text-lg font-semibold">Chat Stimulator</h1>
      </header>

      <main className="flex-1 container max-w-3xl mx-auto p-4 max-md:p-3 max-md:gap-3 max-sm:px-2 flex flex-col gap-4">
        {uiState.speechSupported === false && (
          <div
            role="alert"
            className="rounded-lg bg-amber-900/30 border border-amber-700 text-amber-200 px-3 py-2 max-md:px-2 max-md:py-2 text-sm max-md:text-xs"
          >
            Speech recognition not supported in this browser. Use Chrome/Edge.
          </div>
        )}

        {uiState.error && (
          <div
            role="alert"
            className="rounded-lg bg-rose-900/30 border border-rose-700 text-rose-200 px-3 py-2 max-md:px-2 max-md:py-2 text-sm max-md:text-xs flex justify-between items-center gap-2"
          >
            <span>{uiState.error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-300"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <section className="flex-1 min-h-[300px] max-md:min-h-[240px] flex flex-col">
          <VideoStage
            key={uiState.state}
            currentClip={uiState.currentClip}
            onEnded={dispatchVideoEnded}
            isLooping={uiState.isLooping}
            transitionKey={uiState.state}
            onLoadError={handleVideoLoadError}
            onClipReady={onClipReady}
          />
        </section>

        <Controls
          uiState={uiState}
          onStart={actions.start}
          onStop={actions.stop}
        />

        <DebugPanel
          uiState={uiState}
          onSimulateVideoEnded={dispatchVideoEnded}
        />
      </main>

      <footer className="p-4 max-md:px-3 max-md:py-3 border-t border-zinc-800 text-center text-zinc-500 text-sm max-md:text-xs">
        Chat Stimulator — video conversation flow
      </footer>
    </div>
  );
}
