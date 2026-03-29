import { cn } from "@/shared/utils/helpers/utils";
import type { PipelineStage } from "@/features/reels/types/reel.types";
import { STAGE_DOT, STAGE_LINE, STAGE_LABEL } from "./queue.types";

export function PipelineTrack({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  return (
    <div className="flex items-start">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-start flex-1 min-w-0">
          {/* Connecting line before dot (not on first) */}
          {i > 0 && (
            <div
              className={cn(
                "h-px flex-1 mt-[5px] transition-colors",
                STAGE_LINE[stage.status]
              )}
            />
          )}

          {/* Dot + label column */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                STAGE_DOT[stage.status]
              )}
              title={stage.error}
            />
            <span
              className={cn(
                "text-sm font-medium mt-1.5 text-center leading-tight whitespace-nowrap px-1",
                STAGE_LABEL[stage.status]
              )}
            >
              {stage.label}
            </span>
            {stage.error && (
              <span className="text-sm text-error/65 text-center mt-0.5 leading-tight max-w-[56px] line-clamp-2">
                {stage.error}
              </span>
            )}
          </div>

          {/* Connecting line after dot (not on last) */}
          {i < stages.length - 1 && (
            <div
              className={cn(
                "h-px flex-1 mt-[5px] transition-colors",
                STAGE_LINE[stages[i + 1]?.status ?? "pending"]
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
