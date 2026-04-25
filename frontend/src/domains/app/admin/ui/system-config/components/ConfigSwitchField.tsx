import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Label } from "@/shared/ui/primitives/label";
import { Switch } from "@/shared/ui/primitives/switch";

export function ConfigSwitchField({
  label,
  description,
  value: initialValue,
  onSave,
}: {
  label: string;
  description?: string;
  value: boolean;
  onSave: (val: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleChange = async (checked: boolean) => {
    setValue(checked);
    setSaving(true);
    try {
      await onSave(checked);
      toast.success(`${label} ${checked ? "enabled" : "disabled"}`);
    } catch {
      setValue(!checked);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-overlay-sm bg-overlay-xs px-4 py-3">
      <div className="space-y-0.5 min-w-0">
        <Label className="text-sm font-medium text-studio-fg cursor-pointer leading-none">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-dim-3 mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-dim-3" />}
        <Switch
          checked={value}
          onCheckedChange={handleChange}
          disabled={saving}
        />
      </div>
    </div>
  );
}
