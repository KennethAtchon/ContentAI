# Audio Panel: Script Source Fix, Editable Script & Content Picker

**Status:** Ready to implement
**Informed by:** PM review + UI/UX expert review
**Relates to:** `AudioPanel`, `VoiceoverGenerator`, `generatedContent` DB table, `ChatLayout` session header

---

## The Problem

### Bug: Wrong script text shown

`ChatMessage.tsx:303` calls `onOpenAudio(contentId, message.content)` — passing the **full AI prose response** (markdown, explanations, everything) as the `scriptText`. This flows all the way into the `VoiceoverGenerator` read-only preview and into the TTS API call.

The `generated_content` table already stores clean structured fields:
- `generatedScript` — full spoken word content (the correct TTS source)
- `generatedHook` — short viral opening line (secondary option)
- `generatedCaption` — social post text (NOT for voiceover)

### Gap: No editing affordance

Users cannot edit the script before generating audio. Spoken delivery needs differ from written text — users will always want to tweak phrasing, remove words, adjust rhythm. Forcing them back to chat for every micro-edit kills the flow.

---

## Decisions

### 1. Script source

**Default to `generatedScript`. Offer a Script / Hook toggle. Never use `generatedCaption` for TTS.**

- `generatedScript` is the full spoken word content — correct for voiceover in 90%+ of cases
- `generatedHook` is useful for creators who want audio for just the hook
- `generatedCaption` has emoji, hashtags, and formatting — never read aloud

The `AudioPanel` already has `generatedContentId`. It should **fetch the content record directly** via a new API query rather than accepting `message.content` from the chat. This also removes the need to pass `scriptText` as a prop at all.

### 2. Editability

**Make the script textarea always-editable. Local state only — do not persist edits to the DB.**

- Edits are scoped to the current audio generation session
- The `generatedContent` DB record stays as the canonical AI output
- A "Reset to original" link appears only when the user has modified the text
- The edited local value is what gets sent to the TTS API

### 3. Versioning model

**Multiple `generatedContent` records per chat session — this is already how it works.**

Each AI response that calls `save_content` creates its own `generatedContent` record linked to that message via `chatMessage.generatedContentId`. Do not change this. The chat scroll gives users access to all previous versions by clicking the voiceover chip on any message.

### 4. Content picker — replace "scroll to find it" with a top-bar selector

**Add a generated content picker to the session header bar.** Users should not have to scroll up through a long conversation to find a previous draft.

The session header in `ChatLayout.tsx` (currently just the session title + project name) gains a compact pill-row of the generated content records from this session. Clicking any pill opens that content in the `AudioPanel`.

**Data source:** Already available — `displayMessages` (already loaded) filtered to `m.generatedContentId != null`, ordered by creation time. No extra API calls needed for the picker itself.

**Label strategy:** Use a short snippet derived from the message content (first non-empty line, truncated to ~30 chars) rather than "Draft 1 / Draft 2". This gives users enough context to recognize which version is which ("Hook about morning…" vs "Script for meal prep…").

**Active state:** The currently open AudioPanel's `contentId` determines which pill is highlighted.

### 5. Version history in AudioPanel

**No version history in AudioPanel.** The panel is a focused single-purpose tool. The header picker handles multi-version navigation.

---

## Implementation Plan

### Step 0 — Generated content picker in session header

**Where it lives:** `ChatLayout.tsx`, the `border-b` header div at line 232, which currently shows session title and project name.

**Data derivation (no new API calls needed):**

```typescript
// Derived from already-loaded displayMessages in ChatLayout
const generatedDrafts = useMemo(() => {
  return displayMessages
    .filter((m) => m.role === "assistant" && m.generatedContentId != null)
    .map((m, index) => ({
      contentId: m.generatedContentId!,
      label: deriveLabel(m.content, index + 1), // first non-empty line, max 28 chars
      messageId: m.id,
    }));
}, [displayMessages]);

function deriveLabel(content: string, fallbackIndex: number): string {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  const clean = firstLine.replace(/[#*_`]/g, "").trim(); // strip markdown
  return clean.length > 28 ? clean.slice(0, 25) + "…" : clean || `Draft ${fallbackIndex}`;
}
```

**Layout — updated session header:**

```
┌────────────────────────────────────────────────────────┐
│ Session title                              Project name │  ← existing row
│ [Hook about morning…] [Script for meal…] [+ 1 more]    │  ← NEW pill row
└────────────────────────────────────────────────────────┘
```

- Pill row only renders if `generatedDrafts.length > 0`
- Pill row only renders if `generatedDrafts.length > 0`
- Active pill (matching `audioContext?.contentId`) gets `bg-primary/10 border-primary/40 text-primary` styling
- Inactive pills use `bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground`
- If there are more than 3 pills, collapse extras into a `+N more` overflow button that expands inline (not a dropdown — just reveals the hidden pills)
- Clicking any pill: `setAudioContext({ contentId: pill.contentId })`
- Pill row scrolls horizontally if it overflows (overflow-x-auto, no-scrollbar)

**Pill component (inline, no abstraction needed):**

```tsx
{generatedDrafts.length > 0 && (
  <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto no-scrollbar">
    {generatedDrafts.slice(0, showAll ? undefined : 3).map((draft) => (
      <button
        key={draft.contentId}
        onClick={() => setAudioContext({ contentId: draft.contentId })}
        className={cn(
          "shrink-0 text-[10px] px-2 py-0.5 rounded-full border transition-colors",
          audioContext?.contentId === draft.contentId
            ? "bg-primary/10 border-primary/40 text-primary"
            : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {draft.label}
      </button>
    ))}
    {!showAll && generatedDrafts.length > 3 && (
      <button
        onClick={() => setShowAll(true)}
        className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground hover:bg-muted"
      >
        +{generatedDrafts.length - 3} more
      </button>
    )}
  </div>
)}
```

**`audioContext` state change:** Remove `scriptText` from the shape (see Step 1) so clicking a pill only needs to set `contentId`.

---

### Step 1 — Fix the data source (highest priority, bug fix)

**New hook: `useGeneratedContent(id)`**

```typescript
// frontend/src/features/audio/hooks/use-generated-content.ts
export function useGeneratedContent(id: number) {
  const fetcher = useQueryFetcher();
  return useQuery({
    queryKey: queryKeys.api.generatedContent(id),
    queryFn: () => fetcher<{ content: GeneratedContent }>(`/api/content/${id}`),
    enabled: !!id,
  });
}
```

**Remove `scriptText` prop from `AudioPanel`**

`AudioPanel` already has `generatedContentId`. It fetches the content record internally. Stop passing `scriptText` as a prop entirely.

```diff
// ChatLayout.tsx
- onOpenAudio={(contentId, scriptText) =>
-   setAudioContext({ contentId, scriptText })
- }
+ onOpenAudio={(contentId) => setAudioContext({ contentId })}

// AudioPanel props
- scriptText: string;
+ // removed — fetched internally

// VoiceoverGenerator — receives structured fields
- scriptText: string;
+ generatedScript: string | null;
+ generatedHook: string | null;
```

**Backend**: If `/api/content/:id` doesn't exist yet, add a GET route returning the `generatedContent` record (already authenticated, user owns it).

---

### Step 2 — Editable textarea with Script/Hook toggle

**`VoiceoverGenerator` becomes stateful for the script text**

```tsx
type ScriptMode = "script" | "hook";

export function VoiceoverGenerator({ generatedContentId, generatedScript, generatedHook, onSuccess }) {
  const [mode, setMode] = useState<ScriptMode>("script");
  const canonical = mode === "script" ? (generatedScript ?? generatedHook ?? "") : (generatedHook ?? "");
  const [scriptValue, setScriptValue] = useState(canonical);
  const isModified = scriptValue !== canonical;

  // Reset local value when mode changes
  useEffect(() => {
    setScriptValue(canonical);
  }, [mode]);

  // ...existing voice/speed/generate logic, but use scriptValue instead of scriptText
}
```

**Layout for the script section:**

```
┌──────────────────────────────────────────┐
│ SCRIPT  [Script ▼ / Hook]        [Copy]  │  ← label row
│ ┌────────────────────────────────────────┐│
│ │                                        ││
│ │  [Editable textarea]                   ││  min-h-32, max-h-64
│ │                                        ││
│ └────────────────────────────────────────┘│
│ [Reset to original]           87 words   │  ← utility row (reset only if modified)
└──────────────────────────────────────────┘
```

**Key textarea styling decisions:**
- `bg-background` (not `bg-muted`) — muted = read-only signal in shadcn; this must look like a form input
- `border-input` — unambiguous edit affordance
- `leading-relaxed` — essential for 50–400 word scripts; tight line-height is fatiguing
- `min-h-32 max-h-64` — replaces the current broken `max-h-24`
- `spellCheck` — users editing spoken copy want spell checking

**Sublabel:** Change the current label from just a key to include a "Edit before generating" sub-label so users understand this text is what gets spoken, not just a preview.

---

### Step 3 — Null/empty fallbacks

| State | Behavior |
|---|---|
| `generatedScript` exists | Show it, default mode = "script" |
| `generatedScript` null, `generatedHook` exists | Pre-populate with hook text + amber info label "No script found — using hook text. Edit as needed." |
| Both null | Empty textarea with placeholder "Write the text you want spoken aloud…" |

Hide the Script/Hook toggle if `generatedHook` is null (no point showing it).

---

### Step 4 — Copy affordance + word count

- Copy icon (ghost icon button) right-aligned in the label row — icon swaps to checkmark for 2s on click
- Word count + estimated duration right-aligned in the utility row: `"87 words · ~35s"` (at ~150 wpm)
- No toast for copy — the icon swap is sufficient

---

## What NOT to build

- **Persisting user edits to the DB** — the edited script is ephemeral, used only for this generation. If users want to canonically change the script they iterate in chat.
- **Caption as a voiceover option** — captions have emoji/hashtags, they are not spoken text.
- **Fetching extra data for pill labels** — use `message.content` snippet (already loaded), not a separate API call to get `generatedHook`.
- **A dropdown/popover for the picker** — horizontal pill row is simpler, always visible, and avoids an extra click.
- **Character count limits with warnings** — defer until users actually hit TTS limits in practice.
- **Rich text editing** — TTS ignores formatting, plain text is correct.

---

## Files to change

| File | Change |
|---|---|
| `frontend/src/features/chat/components/ChatLayout.tsx` | Add `generatedDrafts` memo + `showAll` state; render pill row in session header; remove `scriptText` from `audioContext` state shape; update `onOpenAudio` signature |
| `frontend/src/features/chat/components/ChatMessage.tsx:303` | Pass only `contentId` to `onOpenAudio` (remove `message.content`) |
| `frontend/src/features/chat/components/ChatPanel.tsx` | Update `onOpenAudio` prop type: `(contentId: number) => void` |
| `frontend/src/features/audio/components/AudioPanel.tsx` | Remove `scriptText` prop; add `useGeneratedContent(generatedContentId)` call internally |
| `frontend/src/features/audio/components/VoiceoverGenerator.tsx` | Replace read-only div with editable textarea; add Script/Hook toggle; add local state |
| `frontend/src/features/audio/hooks/use-generated-content.ts` | New hook |
| `frontend/src/translations/en.json` | Add keys: `voiceover.scriptSubLabel`, `voiceover.usingHookFallback`, `voiceover.resetScript`, `voiceover.copyScript`, `voiceover.wordCountWithTime` |
| `backend/src/routes/generation/index.ts` (or new route) | Add GET `/api/generation/:id` returning `generatedScript`, `generatedHook`, `generatedCaption` |
