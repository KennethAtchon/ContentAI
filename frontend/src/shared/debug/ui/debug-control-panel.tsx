import { useEffect, useMemo, useRef, useState } from "react";
import { DEBUG_ENABLED, IS_DEVELOPMENT } from "@/shared/config/envUtil";
import {
  debugLog,
  type DebugRuntimeState,
  type RuntimeLogLevel,
} from "@/shared/debug";

const LOG_LEVEL_OPTIONS: RuntimeLogLevel[] = ["debug", "info", "warn", "error"];
const TOGGLE_SHORTCUT = "Ctrl/Cmd + Shift + L";

export function DebugControlPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [namespaceInput, setNamespaceInput] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [snapshot, setSnapshot] = useState<DebugRuntimeState>(() =>
    debugLog.getRuntimeState()
  );
  const [streamText, setStreamText] = useState<string>(() =>
    debugLog.getStreamText()
  );
  const frameRef = useRef<number | null>(null);

  const shouldRender =
    typeof window !== "undefined" && (IS_DEVELOPMENT || DEBUG_ENABLED);

  useEffect(() => {
    if (!shouldRender) return;

    return debugLog.subscribe(() => {
      if (frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setSnapshot(debugLog.getRuntimeState());
        if (isOpen) {
          setStreamText(debugLog.getStreamText());
        }
      });
    });
  }, [isOpen, shouldRender]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldRender) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const isTogglePressed =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "l";

      if (!isTogglePressed) return;
      event.preventDefault();
      setIsOpen((open) => !open);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shouldRender]);

  useEffect(() => {
    if (!isOpen) return;
    setSnapshot(debugLog.getRuntimeState());
    setStreamText(debugLog.getStreamText());
  }, [isOpen]);

  const knownNamespaces = useMemo(
    () => snapshot.knownNamespaces,
    [snapshot.knownNamespaces]
  );

  if (!shouldRender) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugLog.getStreamText());
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1_500);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1_500);
    }
  };

  const handleNamespaceAction = (enabled: boolean) => {
    const namespace = namespaceInput.trim();
    if (!namespace) return;

    debugLog.setNamespaceEnabled(namespace, enabled);
    setNamespaceInput("");
  };

  const copyLabel =
    copyStatus === "copied"
      ? "Copied"
      : copyStatus === "failed"
        ? "Copy failed"
        : "Copy stream";

  return (
    <div className="fixed bottom-3 right-3 z-1200 font-mono text-xs">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded border border-stroke bg-black px-2 py-1 text-dim-2 shadow-lg"
          title={`Open debug panel (${TOGGLE_SHORTCUT})`}
        >
          Debug
        </button>
      ) : (
        <div className="w-[430px] max-w-[90vw] rounded border border-stroke bg-black p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-dim-3">
              Debug Module
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-stroke px-2 py-1 text-dim-2"
              title={`Close (${TOGGLE_SHORTCUT})`}
            >
              Close
            </button>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded border border-stroke px-2 py-1 text-dim-2">
              <input
                type="checkbox"
                checked={snapshot.enabled}
                onChange={(event) => debugLog.setEnabled(event.target.checked)}
              />
              Enabled
            </label>

            <label className="flex items-center gap-2 rounded border border-stroke px-2 py-1 text-dim-2">
              <span>Level</span>
              <select
                value={snapshot.level}
                onChange={(event) =>
                  debugLog.setLevel(event.target.value as RuntimeLogLevel)
                }
                className="min-w-0 flex-1 bg-transparent outline-none"
              >
                {LOG_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-2 rounded border border-stroke p-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dim-3">
              Namespace Filters
            </div>
            <div className="mb-2 flex gap-1">
              <input
                value={namespaceInput}
                onChange={(event) => setNamespaceInput(event.target.value)}
                placeholder="namespace"
                className="min-w-0 flex-1 rounded border border-stroke bg-transparent px-2 py-1 text-dim-2 outline-none"
              />
              <button
                type="button"
                onClick={() => handleNamespaceAction(false)}
                className="rounded border border-stroke px-2 py-1 text-dim-2"
              >
                Off
              </button>
              <button
                type="button"
                onClick={() => handleNamespaceAction(true)}
                className="rounded border border-stroke px-2 py-1 text-dim-2"
              >
                On
              </button>
            </div>

            <div className="mb-2 flex flex-wrap gap-1">
              {knownNamespaces.map((namespace) => {
                const isEnabled =
                  !snapshot.disabledNamespaces.includes(namespace);
                return (
                  <button
                    key={namespace}
                    type="button"
                    onClick={() =>
                      debugLog.setNamespaceEnabled(namespace, !isEnabled)
                    }
                    className={`rounded border px-2 py-1 ${
                      isEnabled
                        ? "border-emerald-500/40 text-emerald-400"
                        : "border-rose-500/40 text-rose-400"
                    }`}
                  >
                    {namespace}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => debugLog.clearNamespaceFilters()}
              className="rounded border border-stroke px-2 py-1 text-dim-2"
            >
              Clear namespace filters
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2 text-dim-3">
            <span>
              Stream entries: {snapshot.streamEntryCount} /{" "}
              {snapshot.streamLimit}
            </span>
            <span>{TOGGLE_SHORTCUT}</span>
          </div>

          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-stroke px-2 py-1 text-dim-2"
            >
              {copyLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                debugLog.clearStream();
                setStreamText("");
              }}
              className="rounded border border-stroke px-2 py-1 text-dim-2"
            >
              Clear stream
            </button>
            <button
              type="button"
              onClick={() => setStreamText(debugLog.getStreamText())}
              className="rounded border border-stroke px-2 py-1 text-dim-2"
            >
              Refresh
            </button>
          </div>

          <textarea
            readOnly
            value={streamText}
            className="h-52 w-full resize-y rounded border border-stroke bg-black px-2 py-1 text-[11px] text-dim-2 outline-none"
          />
        </div>
      )}
    </div>
  );
}
