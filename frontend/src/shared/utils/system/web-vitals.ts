/**
 * Web Vitals monitoring
 * Reports Core Web Vitals and custom performance metrics
 */

import { Metric } from "web-vitals";
import { debugLog } from "../debug/debug";

// Performance thresholds for medical/healthcare applications
const PERFORMANCE_THRESHOLDS = {
  LCP: 2500, // Largest Contentful Paint (2.5s)
  FID: 100, // First Input Delay (100ms)
  CLS: 0.1, // Cumulative Layout Shift (0.1)
  FCP: 1800, // First Contentful Paint (1.8s)
  TTFB: 800, // Time to First Byte (800ms)
  INP: 200, // Interaction to Next Paint (200ms)
} as const;

// Enhanced performance rating for healthcare applications
function getPerformanceRating(
  metric: Metric
): "good" | "needs-improvement" | "poor" {
  const threshold =
    PERFORMANCE_THRESHOLDS[metric.name as keyof typeof PERFORMANCE_THRESHOLDS];
  if (!threshold) return "good";

  if (metric.value <= threshold) return "good";
  if (metric.value <= threshold * 1.5) return "needs-improvement";
  return "poor";
}

// Medical-specific performance tracking
function trackMedicalFormPerformance(): void {
  if (typeof window === "undefined") return;

  // Track form load times for patient intake forms
  const formElements = document.querySelectorAll("[data-medical-form]");
  formElements.forEach((form) => {
    const loadTime = performance.now();
    // Store performance data for medical forms
    sessionStorage.setItem(
      `medical-form-${form.id}-load-time`,
      loadTime.toString()
    );
  });
}

// Search performance for medical terminology
function trackSearchPerformance(): void {
  if (typeof window === "undefined") return;

  // Track search response times for medical terminology searches
  const searchInputs = document.querySelectorAll("[data-medical-search]");
  searchInputs.forEach((input) => {
    const observer = new MutationObserver(() => {
      const searchTime = performance.now();
      sessionStorage.setItem(
        `medical-search-${input.id}-time`,
        searchTime.toString()
      );
    });
    observer.observe(input, { attributes: true });
  });
}

function sendToAnalytics(metric: Metric): void {
  // Send to Google Analytics 4
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag();
  }

  // Enhanced logging for medical applications
  const rating = getPerformanceRating(metric);
  const isPoorPerformance = rating === "poor";

  if (isPoorPerformance) {
    debugLog.warn(`Poor performance detected`, {
      service: "web-vitals",
      operation: "sendToAnalytics",
      metricName: metric.name,
      metricValue: metric.value,
      rating,
    });
  }

  // Store in session storage for medical compliance tracking
  sessionStorage.setItem(
    `web-vital-${metric.name}`,
    JSON.stringify({
      value: metric.value,
      rating,
      timestamp: new Date().toISOString(),
    })
  );
}

// Enhanced performance monitoring for medical services
export const reportWebVitals = (): void => {
  if (typeof window === "undefined") return;

  try {
    import("web-vitals").then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS(sendToAnalytics);
      onINP(sendToAnalytics);
      onFCP(sendToAnalytics);
      onLCP(sendToAnalytics);
      onTTFB(sendToAnalytics);
    });
  } catch {
    // Error logging removed for production
  }
};

// Enhanced performance monitoring for medical services
export const reportMedicalServicePerformance = (): void => {
  if (typeof window === "undefined") return;

  // Track therapy page load performance
  if (window.location.pathname.includes("/therapies")) {
    const navigationEntries = performance.getEntriesByType("navigation");
    if (navigationEntries.length > 0) {
      const loadTime =
        navigationEntries[0].loadEventEnd - navigationEntries[0].loadEventStart;
      sessionStorage.setItem("therapy-page-load-time", loadTime.toString());
    }
  }

  // Track appointment booking performance
  if (window.location.pathname.includes("/appointments")) {
    const bookingForm = document.querySelector("#appointment-booking-form");
    if (bookingForm) {
      const renderTime = performance.now();
      sessionStorage.setItem("booking-form-render-time", renderTime.toString());
    }
  }
};

// Initialize medical performance tracking
export const initializeMedicalPerformanceTracking = (): void => {
  if (typeof window === "undefined") return;

  // Start web vitals reporting
  reportWebVitals();

  // Start medical-specific tracking
  setTimeout(() => {
    reportMedicalServicePerformance();
    trackMedicalFormPerformance();
    trackSearchPerformance();
  }, 1000);
};

// Types for global browser APIs
declare global {
  interface Window {
    gtag?: () => void;
  }
}

export default reportWebVitals;
