import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/primitives/select";

const ASPECT_RATIO_OPTIONS = [
  { label: "9:16", ratios: ["1080x1920", "720x1280", "2160x3840"] },
  { label: "16:9", ratios: ["1920x1080"] },
  { label: "1:1", ratios: ["1080x1080"] },
] as const;

const QUALITY_OPTIONS: Record<string, { value: string; labelKey: string }[]> = {
  "9:16": [
    { value: "720x1280", labelKey: "editor_resolution_portrait_sd" },
    { value: "1080x1920", labelKey: "editor_resolution_portrait_hd" },
    { value: "2160x3840", labelKey: "editor_resolution_portrait_4k" },
  ],
  "16:9": [{ value: "1920x1080", labelKey: "editor_resolution_landscape" }],
  "1:1": [{ value: "1080x1080", labelKey: "editor_resolution_square" }],
};

function inferAspectRatio(resolution: string): string {
  if (["1080x1920", "720x1280", "2160x3840"].includes(resolution))
    return "9:16";
  if (resolution === "1920x1080") return "16:9";
  return "1:1";
}

interface Props {
  resolution: string;
  onChange: (resolution: string) => void;
}

export function ResolutionPicker({ resolution, onChange }: Props) {
  const { t } = useTranslation();
  const activeRatio = inferAspectRatio(resolution);
  const qualityOptions = QUALITY_OPTIONS[activeRatio];

  return (
    <div className="flex items-center gap-1.5">
      {/* Aspect ratio toggle */}
      <div className="flex rounded border border-overlay-md overflow-hidden">
        {ASPECT_RATIO_OPTIONS.map(({ label, ratios }) => (
          <button
            key={label}
            onClick={() => onChange(ratios[0])}
            className={cn(
              "px-2 py-1 text-xs transition-colors cursor-pointer",
              activeRatio === label
                ? "bg-studio-accent/20 text-studio-accent"
                : "bg-overlay-sm text-dim-3 hover:text-dim-1"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Quality picker — only shown when multiple options exist for the ratio */}
      {qualityOptions.length > 1 && (
        <Select value={resolution} onValueChange={onChange}>
          <SelectTrigger className="h-7 text-xs bg-overlay-sm border-overlay-md text-dim-2 w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {qualityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
