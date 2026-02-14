import type { ConversationState } from "./types";

export const CONVERSATION_STATES: readonly ConversationState[] = [
  "IDLE",
  "GREETING",
  "LISTENING",
  "RESPONDING",
  "GOODBYE",
] as const;

export function isConversationState(s: string): s is ConversationState {
  return CONVERSATION_STATES.includes(s as ConversationState);
}
