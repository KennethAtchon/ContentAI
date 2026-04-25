import type { Transition, VideoClip } from "../../model/editor";
import { TransitionContextMenu } from "./ClipContextMenu";

interface Props {
  clipA: VideoClip;
  clipB: VideoClip;
  transition: Transition | undefined;
  zoom: number;
  onSelect: () => void;
  onRemoveTransition: () => void;
}

export function TransitionDiamond({
  clipA,
  clipB,
  transition,
  zoom,
  onSelect,
  onRemoveTransition,
}: Props) {
  const gapStartPx = ((clipA.startMs + clipA.durationMs) / 1000) * zoom;
  const gapEndPx = (clipB.startMs / 1000) * zoom;
  const midPx = (gapStartPx + gapEndPx) / 2;

  const hasTransition = transition && transition.type !== "none";

  return (
    <TransitionContextMenu
      transition={transition}
      onRemove={onRemoveTransition}
    >
      <button
        style={{
          position: "absolute",
          left: midPx - 8,
          top: "50%",
          transform: "translateY(-50%)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`w-4 h-4 flex items-center justify-center border-0 bg-transparent cursor-pointer text-sm ${
          hasTransition ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
        }`}
      >
        &#9670;
      </button>
    </TransitionContextMenu>
  );
}
