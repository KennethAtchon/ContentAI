import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/shared/ui/primitives/input";
import { Label } from "@/shared/ui/primitives/label";
import { cn } from "@/shared/lib/utils";
import { SaveButton } from "./SaveButton";

export function ConfigTextField({
  label,
  description,
  value: initialValue,
  onSave,
  type = "text",
  placeholder,
  prefix,
}: {
  label: string;
  description?: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  type?: string;
  placeholder?: string;
  prefix?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
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
        <Input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={cn("flex-1", prefix && "rounded-l-none")}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>
    </div>
  );
}
