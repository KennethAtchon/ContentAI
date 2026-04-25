import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface UseResolvedParamOptions {
  paramValue?: string | number | null;
  isLoading?: boolean;
  isMissing: boolean;
  notFoundMessage: string;
  onMissing: () => void;
}

export function useResolvedParam({
  paramValue,
  isLoading = false,
  isMissing,
  notFoundMessage,
  onMissing,
}: UseResolvedParamOptions) {
  const handledValueRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (paramValue == null || paramValue === "") {
      handledValueRef.current = null;
      return;
    }
    if (isLoading || !isMissing) return;
    if (handledValueRef.current === paramValue) return;

    handledValueRef.current = paramValue;
    toast.error(notFoundMessage);
    onMissing();
  }, [isLoading, isMissing, notFoundMessage, onMissing, paramValue]);
}
