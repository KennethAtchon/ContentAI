import { cn } from "@/shared/lib/utils";

// ── Toast ─────────────────────────────────────────────────────────────────────

export function NicheToast({
  message,
  type = "info",
}: {
  message: string;
  type?: "info" | "success" | "error";
}) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-base font-medium border max-w-xs",
        type === "success" && "bg-success/20 border-success/30 text-success",
        type === "error" && "bg-error/20 border-error/30 text-error",
        type === "info" &&
          "bg-studio-accent/20 border-studio-accent/30 text-studio-accent"
      )}
    >
      {message}
    </div>
  );
}
