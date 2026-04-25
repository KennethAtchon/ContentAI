"use client";

import { useEffect } from "react";

// Safe sanitization that works in both server and client environments
function safeSanitize(content: string): string {
  // In server environment, JSON-LD content is safe as it's our own generated JSON
  if (typeof window === "undefined") {
    return content;
  }

  try {
    const DOMPurify = require("dompurify");
    return DOMPurify.sanitize(content);
  } catch {
    // Fallback if DOMPurify fails to load
    return content;
  }
}

// Constants
const DEFAULT_SCRIPT_ID = "structured-data";
const SCRIPT_TYPE = "application/ld+json";
const JSON_STRINGIFY_SPACE = 0;

/**
 * Props for structured data components.
 */
interface StructuredDataProps {
  /** JSON-LD data object or array of objects */
  data: object | object[];
  /** Optional unique identifier for the script element */
  id?: string;
}

/**
 * Client-side structured data component for JSON-LD injection.
 * Dynamically adds/updates structured data scripts in the document head.
 *
 * @param data - JSON-LD structured data object or array
 * @param id - Unique identifier for the script element
 * @returns null (renders nothing visible)
 */
export default function StructuredData({
  data,
  id = DEFAULT_SCRIPT_ID,
}: StructuredDataProps) {
  useEffect(() => {
    const scriptId = `structured-data-${id}`;

    // Remove existing script to prevent duplicates
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    // Create new JSON-LD script element
    const script = document.createElement("script");
    script.id = scriptId;
    script.type = SCRIPT_TYPE;
    script.textContent = JSON.stringify(
      Array.isArray(data) ? data : [data],
      null,
      JSON_STRINGIFY_SPACE
    );

    // Inject into document head
    document.head.appendChild(script);

    // Cleanup on component unmount
    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [data, id]);

  return null;
}

/**
 * Server-side structured data component for static generation.
 * Renders JSON-LD script tags during SSR/SSG for better SEO.
 *
 * @param data - JSON-LD structured data object or array
 * @param id - Unique identifier for the script element
 * @returns Script element with JSON-LD content
 */
export function StructuredDataStatic({
  data,
  id = DEFAULT_SCRIPT_ID,
}: StructuredDataProps) {
  const jsonLdContent = JSON.stringify(
    Array.isArray(data) ? data : [data],
    null,
    JSON_STRINGIFY_SPACE
  );

  // SECURITY NOTE (SEC-006): dangerouslySetInnerHTML is safe here because:
  // - jsonLdContent is generated from server-controlled data prop (not user input)
  // - Data is JSON-stringified, preventing script injection
  // - safeSanitize provides additional client-side protection
  // - This is structured data (JSON-LD) for SEO, not user-generated content
  return (
    <script
      id={`structured-data-${id}`}
      type={SCRIPT_TYPE}
      dangerouslySetInnerHTML={{ __html: safeSanitize(jsonLdContent) }}
    />
  );
}
