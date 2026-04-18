import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface InspectorSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function InspectorSection({
  title,
  children,
  defaultOpen = true,
}: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dashed border-overlay-sm pb-3 mb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full text-left mb-2 cursor-pointer bg-transparent border-0 p-0"
      >
        {open ? (
          <ChevronDown size={10} className="text-dim-3 shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-dim-3 shrink-0" />
        )}
        <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
          {title}
        </p>
      </button>
      {open && children}
    </div>
  );
}
