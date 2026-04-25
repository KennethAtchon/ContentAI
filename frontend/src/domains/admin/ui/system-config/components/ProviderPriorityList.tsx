import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, Circle } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Label } from "@/shared/ui/primitives/label";
import { cn } from "@/shared/lib/utils";
import { SaveButton } from "./SaveButton";

export function ProviderPriorityList({
  label,
  description,
  items: initialItems,
  onSave,
  displayNames,
  providerStatus,
}: {
  label: string;
  description?: string;
  items: string[];
  onSave: (items: string[]) => Promise<void>;
  displayNames?: Record<string, string>;
  providerStatus?: Record<string, boolean>;
}) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const serialized = JSON.stringify(initialItems);

  useEffect(() => {
    try {
      setItems(JSON.parse(serialized) as string[]);
    } catch {
      // expected: malformed serialized value — keep current items
    }
  }, [serialized]);

  const move = (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-studio-fg">{label}</Label>
      {description && <p className="text-xs text-dim-3">{description}</p>}
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const isActive = providerStatus
            ? (providerStatus[item] ?? false)
            : undefined;
          return (
            <div
              key={item}
              className="flex items-center gap-3 rounded-lg border border-overlay-sm bg-overlay-xs px-3 py-2.5"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-studio-accent/20 text-xs font-bold text-studio-accent shrink-0">
                {idx + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-studio-fg">
                {displayNames?.[item] ?? item}
              </span>
              {isActive !== undefined && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium shrink-0",
                    isActive ? "text-green-400" : "text-dim-3"
                  )}
                >
                  <Circle
                    className={cn(
                      "h-2 w-2",
                      isActive
                        ? "fill-green-400 text-green-400"
                        : "fill-dim-3 text-dim-3"
                    )}
                  />
                  {isActive ? "Active" : "No key"}
                </span>
              )}
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-dim-3 hover:text-studio-fg"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-dim-3 hover:text-studio-fg"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end pt-1">
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>
    </div>
  );
}
