import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Label } from "@/shared/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/primitives/select";

export function ConfigSelectField({
  label,
  description,
  value: initialValue,
  onSave,
  options,
}: {
  label: string;
  description?: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleChange = async (newVal: string) => {
    setValue(newVal);
    setSaving(true);
    try {
      await onSave(newVal);
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
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && (
          <Loader2 className="h-4 w-4 animate-spin text-dim-3 shrink-0" />
        )}
        {saved && !saving && (
          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
        )}
      </div>
    </div>
  );
}
