/** Valid status transitions: Draft → Ready → Scheduled → Posted (Failed from any) */
export const VALID_QUEUE_TRANSITIONS: Record<string, string[]> = {
  draft: ["ready", "scheduled"],
  ready: ["draft", "scheduled"],
  scheduled: ["ready", "posted"],
  posted: [],
  failed: ["draft"],
};
