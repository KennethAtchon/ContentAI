import { useTranslation } from "react-i18next";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import type { TTSSpeed } from "../types/audio.types";

interface SpeedToggleProps {
  value: TTSSpeed;
  onChange: (value: TTSSpeed) => void;
  disabled?: boolean;
}

export function SpeedToggle({ value, onChange, disabled }: SpeedToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-muted-foreground">
        {t("audio_speed_label")}
      </label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as TTSSpeed)}
        disabled={disabled}
        className="justify-start"
      >
        <ToggleGroupItem value="slow" className="text-sm px-3">
          {t("audio_speed_slow")}
        </ToggleGroupItem>
        <ToggleGroupItem value="normal" className="text-sm px-3">
          {t("audio_speed_normal")}
        </ToggleGroupItem>
        <ToggleGroupItem value="fast" className="text-sm px-3">
          {t("audio_speed_fast")}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
