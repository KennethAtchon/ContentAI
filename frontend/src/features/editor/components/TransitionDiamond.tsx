import type { Clip, Transition } from "../types/editor";

interface Props {
  clipA: Clip;
  clipB: Clip;
  transition: Transition | undefined;
  zoom: number;
  onSelect: () => void;
}

export function TransitionDiamond({
  clipA,
  clipB,
  transition,
  zoom,
  onSelect,
}: Props) {
  const gapStartPx = ((clipA.startMs + clipA.durationMs) / 1000) * zoom;
  const gapEndPx = (clipB.startMs / 1000) * zoom;
  const midPx = (gapStartPx + gapEndPx) / 2;

  const hasTransition = transition && transition.type !== "none";

  return (
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
  );
}
