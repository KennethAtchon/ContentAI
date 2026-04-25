import { forwardRef, useImperativeHandle } from "react";

export interface CaptionLayerHandle {
  syncPlayback: (ms: number) => void;
}

interface CaptionLayerProps {
  onBitmapReady?: (bitmap: ImageBitmap | null) => void;
}

export const CaptionLayer = forwardRef<CaptionLayerHandle, CaptionLayerProps>(
  function CaptionLayer({ onBitmapReady }, ref) {
    useImperativeHandle(
      ref,
      () => ({
        syncPlayback: () => undefined,
      }),
      []
    );

    void onBitmapReady;
    return null;
  }
);
