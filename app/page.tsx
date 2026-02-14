"use client";

import { VideoStage } from "@/components/VideoStage/VideoStage";
import { Controls } from "@/components/Controls/Controls";
import { DebugPanel } from "@/components/DebugPanel/DebugPanel";
import type { ClipId } from "@/domain/conversation/types";
import { useConversationController } from "@/hooks/useConversationController";
import { getClipSrc } from "@/lib/video/clips";

export default function Home() {
  const {
    uiState,
    actions,
    dispatchVideoEnded,
    onClipReady,
    setError,
    dispatchSpeechResult,
  } = useConversationController();

  const handleVideoLoadError = (clip: ClipId, _err: unknown) => {
    setError(`Missing or failed to load video: ${getClipSrc(clip)}`);
  };

  const showTypedFallback = uiState.permissionDenied || uiState.speechSupported === false;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <header className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-semibold">Chat Stimulator</h1>
      </header>

      <main className="flex-1 container max-w-2xl mx-auto p-4 flex flex-col gap-4">
        {uiState.speechSupported === false && (
          <div
            role="alert"
            className="rounded-lg bg-amber-900/30 border border-amber-700 text-amber-200 px-3 py-2 text-sm"
          >
            Speech recognition not supported in this browser. Use Chrome/Edge.
          </div>
        )}

        {uiState.error && (
          <div
            role="alert"
            className="rounded-lg bg-rose-900/30 border border-rose-700 text-rose-200 px-3 py-2 text-sm flex justify-between items-center gap-2"
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

        <section className="flex-1 min-h-0 flex flex-col">
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
          onStartWithTypedFallback={showTypedFallback ? actions.startWithTypedFallback : undefined}
          onTypedSubmit={showTypedFallback ? dispatchSpeechResult : undefined}
        />

        <DebugPanel uiState={uiState} onSimulateVideoEnded={dispatchVideoEnded} />
      </main>

      <footer className="p-4 border-t border-zinc-800 text-center text-zinc-500 text-sm">
        Chat Stimulator — video conversation flow
      </footer>
    </div>
  );
}
