import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Music, Loader2 } from "lucide-react";
import { Slider } from "@/shared/components/ui/slider";

interface VolumeBalanceProps {
  value: number; // 0–100, voiceover percentage
  onChange: (value: number) => void;
  disabled?: boolean;
  isSaving?: boolean;
}

export function VolumeBalance({
  value,
  onChange,
  disabled,
  isSaving,
}: VolumeBalanceProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (values: number[]) => {
    const newValue = values[0];
    setLocalValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          {t("audio_volume_label")}
        </label>
        {isSaving && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Mic className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Slider
          min={0}
          max={100}
          step={1}
          value={[localValue]}
          onValueChange={handleChange}
          disabled={disabled}
          className="flex-1"
        />
        <Music className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground px-5">
        <span>
          {t("audio_volume_voice")} {localValue}%
        </span>
        <span>
          {t("audio_volume_music")} {100 - localValue}%
        </span>
      </div>
    </div>
  );
}
