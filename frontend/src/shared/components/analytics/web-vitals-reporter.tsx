"use client";

import { useEffect } from "react";
import initializeMedicalPerformanceTracking from "@/shared/utils/system/web-vitals";

export function WebVitalsReporter() {
  useEffect(() => {
    // Initialize performance monitoring when component mounts
    initializeMedicalPerformanceTracking();
  }, []);

  // This component doesn't render anything
  return null;
}
