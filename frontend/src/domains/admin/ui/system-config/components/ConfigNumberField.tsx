import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/shared/ui/primitives/input";
import { Label } from "@/shared/ui/primitives/label";
import { cn } from "@/shared/lib/utils";
import { SaveButton } from "./SaveButton";

export function ConfigNumberField({
  label,
  description,
  value: initialValue,
  onSave,
  min,
  max,
  suffix,
  prefix,
}: {
  label: string;
  description?: string;
  value: number;
  onSave: (val: number) => Promise<void>;
  min?: number;
  max?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(String(initialValue)), [initialValue]);

  const handleSave = async () => {
    const num = Number(value);
    if (isNaN(num)) {
      toast.error("Invalid number");
      return;
    }
    setSaving(true);
    try {
      await onSave(num);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-studio-fg">{label}</Label>
      {description && <p className="text-xs text-dim-3">{description}</p>}
      <div className="flex items-center gap-2">
        {prefix && (
          <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground shrink-0">
            {prefix}
          </span>
        )}
        <div className="relative flex-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min={min}
            max={max}
            className={cn(suffix && "pr-14", prefix && "rounded-l-none")}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim-3 pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>
    </div>
  );
}
