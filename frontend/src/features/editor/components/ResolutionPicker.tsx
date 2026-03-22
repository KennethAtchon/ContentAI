import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

const RESOLUTION_OPTIONS = [
  { value: "1080x1920", labelKey: "editor_resolution_portrait_hd" },
  { value: "720x1280", labelKey: "editor_resolution_portrait_sd" },
  { value: "2160x3840", labelKey: "editor_resolution_portrait_4k" },
  { value: "1920x1080", labelKey: "editor_resolution_landscape" },
  { value: "1080x1080", labelKey: "editor_resolution_square" },
] as const;

interface Props {
  resolution: string;
  onChange: (resolution: string) => void;
}

export function ResolutionPicker({ resolution, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <Select value={resolution} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs bg-overlay-sm border-overlay-md text-dim-2 w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RESOLUTION_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {t(opt.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
