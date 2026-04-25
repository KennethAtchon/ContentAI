/**
 * Centralized debug logging utility with PII sanitization.
 *
 * Features:
 * - Runtime log-level controls (no rebuild required)
 * - Namespace filtering (disable noisy components)
 * - In-memory log stream for copy/export from the debug control panel
 */

import {
  sanitizeObject,
  sanitizeString,
} from "@/shared/security/pii-sanitization";
import {
  DEBUG_ENABLED,
  LOG_LEVEL,
  IS_DEVELOPMENT,
} from "@/shared/config/envUtil";

const LOG_LEVELS = {
  debug: 0,
  timezone: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
} as const;

const RUNTIME_LEVELS = ["debug", "info", "warn", "error"] as const;

const STORAGE_KEYS = {
  enabled: "contentai.debug.enabled",
  level: "contentai.debug.level",
  disabledNamespaces: "contentai.debug.disabledNamespaces",
} as const;

const DEFAULT_STREAM_LIMIT = 4_000;

export type LogLevel =
  | "info"
  | "warn"
  | "error"
  | "debug"
  | "timezone"
  | "critical";

export type RuntimeLogLevel = (typeof RUNTIME_LEVELS)[number];

export interface DebugContext {
  component?: string;
  namespace?: string;
  function?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface DebugStreamEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  namespace: string;
  message: string;
  formattedMessage: string;
  line: string;
  context?: DebugContext;
  data?: unknown;
}

export interface DebugRuntimeState {
  enabled: boolean;
  level: RuntimeLogLevel;
  disabledNamespaces: string[];
  knownNamespaces: string[];
  streamEntryCount: number;
  streamLimit: number;
}

interface WindowDebugModule {
  setEnabled(enabled: boolean): void;
  setLevel(level: RuntimeLogLevel): void;
  disableNamespace(namespace: string): void;
  enableNamespace(namespace: string): void;
  clearNamespaceFilters(): void;
  clearStream(): void;
  getState(): DebugRuntimeState;
  getStreamText(): string;
}

declare global {
  interface Window {
    __CONTENTAI_DEBUG__?: WindowDebugModule;
  }
}

const isRuntimeLogLevel = (value: string): value is RuntimeLogLevel =>
  (RUNTIME_LEVELS as readonly string[]).includes(value);

const normalizeNamespace = (namespace: string | null | undefined): string => {
  const trimmed = (namespace ?? "").trim();
  return trimmed.length > 0 ? trimmed : "app";
};

const safeSerialize = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
};

class DebugLogger {
  private enabled: boolean;
  private level: RuntimeLogLevel;
  private readonly disabledNamespaces = new Set<string>();
  private readonly knownNamespaces = new Set<string>();
  private readonly stream: DebugStreamEntry[] = [];
  private readonly listeners = new Set<() => void>();
  private streamLimit = DEFAULT_STREAM_LIMIT;
  private streamEntrySequence = 0;

  constructor(enabled = DEBUG_ENABLED) {
    this.enabled = enabled;
    this.level = isRuntimeLogLevel(LOG_LEVEL) ? LOG_LEVEL : "warn";
    this.loadRuntimeSettings();
    this.publishWindowModule();
  }

  private publishWindowModule(): void {
    if (typeof window === "undefined") return;

    window.__CONTENTAI_DEBUG__ = {
      setEnabled: (enabled) => this.setEnabled(enabled),
      setLevel: (level) => this.setLevel(level),
      disableNamespace: (namespace) => this.disableNamespace(namespace),
      enableNamespace: (namespace) => this.enableNamespace(namespace),
      clearNamespaceFilters: () => this.clearNamespaceFilters(),
      clearStream: () => this.clearStream(),
      getState: () => this.getRuntimeState(),
      getStreamText: () => this.getStreamText(),
    };
  }

  private loadRuntimeSettings(): void {
    if (typeof window === "undefined") return;

    try {
      const storedEnabled = window.localStorage.getItem(STORAGE_KEYS.enabled);
      if (storedEnabled === "true" || storedEnabled === "false") {
        this.enabled = storedEnabled === "true";
      }

      const storedLevel = window.localStorage.getItem(STORAGE_KEYS.level);
      if (storedLevel && isRuntimeLogLevel(storedLevel)) {
        this.level = storedLevel;
      }

      const storedNamespaces = window.localStorage.getItem(
        STORAGE_KEYS.disabledNamespaces
      );
      if (storedNamespaces) {
        const parsed = JSON.parse(storedNamespaces) as unknown;
        if (Array.isArray(parsed)) {
          this.disabledNamespaces.clear();
          for (const value of parsed) {
            if (typeof value === "string") {
              this.disabledNamespaces.add(normalizeNamespace(value));
            }
          }
        }
      }
    } catch {
      // Ignore storage errors and keep defaults.
    }
  }

  private persistRuntimeSettings(): void {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEYS.enabled, String(this.enabled));
      window.localStorage.setItem(STORAGE_KEYS.level, this.level);
      window.localStorage.setItem(
        STORAGE_KEYS.disabledNamespaces,
        JSON.stringify(this.getDisabledNamespaces())
      );
    } catch {
      // Ignore storage persistence errors.
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getRuntimeState(): DebugRuntimeState {
    return {
      enabled: this.enabled,
      level: this.level,
      disabledNamespaces: this.getDisabledNamespaces(),
      knownNamespaces: this.getKnownNamespaces(),
      streamEntryCount: this.stream.length,
      streamLimit: this.streamLimit,
    };
  }

  private resolveNamespace(message: string, context?: DebugContext): string {
    if (context?.namespace && typeof context.namespace === "string") {
      return normalizeNamespace(context.namespace);
    }

    if (context?.component && typeof context.component === "string") {
      return normalizeNamespace(context.component);
    }

    const bracketPrefix = /^\[([^\]\s]+)]/.exec(message);
    if (bracketPrefix?.[1]) {
      return normalizeNamespace(bracketPrefix[1]);
    }

    return "app";
  }

  private shouldEmit(level: LogLevel, namespace: string): boolean {
    if (level === "critical") return true;

    if (this.disabledNamespaces.has(namespace)) {
      return false;
    }

    if (!this.enabled && level !== "error") {
      return false;
    }

    if (level === "error") {
      return true;
    }

    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private appendStream(entry: DebugStreamEntry): void {
    this.stream.push(entry);
    if (this.stream.length > this.streamLimit) {
      this.stream.splice(0, this.stream.length - this.streamLimit);
    }
    this.notifyListeners();
  }

  private formatAndEmit(
    level: LogLevel,
    message: string,
    context?: DebugContext,
    data?: unknown
  ): void {
    const namespace = this.resolveNamespace(message, context);
    this.knownNamespaces.add(namespace);

    if (!this.shouldEmit(level, namespace)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    const shouldSanitize = level !== "error" && !IS_DEVELOPMENT;
    const sanitizedMessage = shouldSanitize
      ? sanitizeString(`${prefix} ${message}`)
      : `${prefix} ${message}`;
    const sanitizedContext: DebugContext | undefined =
      shouldSanitize && context
        ? (sanitizeObject(context) as DebugContext)
        : context;
    const sanitizedData = shouldSanitize && data ? sanitizeObject(data) : data;

    let formattedMessage = sanitizedMessage;

    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      const contextStr = Object.entries(sanitizedContext)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ");
      formattedMessage += ` | ${contextStr}`;
    }

    const dataSuffix =
      sanitizedData === undefined ? "" : ` ${safeSerialize(sanitizedData)}`;

    const streamEntry: DebugStreamEntry = {
      id: ++this.streamEntrySequence,
      timestamp,
      level,
      namespace,
      message,
      formattedMessage,
      line: `${formattedMessage}${dataSuffix}`,
      context: sanitizedContext,
      data: sanitizedData,
    };

    const logMethod =
      level === "error" || level === "critical"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "debug" || level === "timezone"
            ? console.debug
            : console.info;

    if (sanitizedData !== undefined) {
      logMethod(formattedMessage, sanitizedData);
    } else {
      logMethod(formattedMessage);
    }

    this.appendStream(streamEntry);
  }

  info(message: string, context?: DebugContext, data?: unknown): void {
    this.formatAndEmit("info", message, context, data);
  }

  warn(message: string, context?: DebugContext, data?: unknown): void {
    this.formatAndEmit("warn", message, context, data);
  }

  error(message: string, context?: DebugContext, data?: unknown): void {
    this.formatAndEmit("error", message, context, data);
  }

  debug(message: string, context?: DebugContext, data?: unknown): void {
    this.formatAndEmit("debug", message, context, data);
  }

  timezone(message: string, context?: DebugContext, data?: unknown): void {
    this.formatAndEmit("timezone", message, context, data);
  }

  critical(message: string, context?: DebugContext, data?: unknown): void {
    this.formatAndEmit("critical", message, context, data);
  }

  logTimeConversion(
    operation: string,
    originalTime: string | Date,
    convertedTime: string | Date,
    timezone?: string,
    context?: DebugContext
  ): void {
    this.timezone(
      `${operation}: ${originalTime} -> ${convertedTime}${timezone ? ` (${timezone})` : ""}`,
      context,
      {
        original: originalTime,
        converted: convertedTime,
        timezone,
        userTimezone: this.getUserTimezone(),
        timezoneOffset: this.getTimezoneOffset(),
      }
    );
  }

  private getUserTimezone(): string {
    try {
      return typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Unknown";
    } catch {
      return "Unknown";
    }
  }

  private getTimezoneOffset(): number {
    try {
      return new Date().getTimezoneOffset();
    } catch {
      return 0;
    }
  }

  componentLifecycle(
    component: string,
    lifecycle: string,
    data?: unknown,
    context?: DebugContext
  ): void {
    this.debug(
      `Component ${component} - ${lifecycle}`,
      { component, ...context },
      data
    );
  }

  apiCall(
    method: string,
    url: string,
    status: "start" | "success" | "error",
    context?: DebugContext,
    data?: unknown
  ): void {
    const level: LogLevel =
      status === "error" ? "error" : status === "success" ? "info" : "debug";
    this.formatAndEmit(
      level,
      `API ${method} ${url} - ${status}`,
      context,
      data
    );
  }

  group(label: string, callback: () => void): void {
    if (!this.enabled) {
      callback();
      return;
    }

    console.group(label);
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.persistRuntimeSettings();
    this.notifyListeners();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setLevel(level: RuntimeLogLevel): void {
    this.level = level;
    this.persistRuntimeSettings();
    this.notifyListeners();
  }

  getLevel(): RuntimeLogLevel {
    return this.level;
  }

  disableNamespace(namespace: string): void {
    this.disabledNamespaces.add(normalizeNamespace(namespace));
    this.persistRuntimeSettings();
    this.notifyListeners();
  }

  enableNamespace(namespace: string): void {
    this.disabledNamespaces.delete(normalizeNamespace(namespace));
    this.persistRuntimeSettings();
    this.notifyListeners();
  }

  setNamespaceEnabled(namespace: string, enabled: boolean): void {
    if (enabled) {
      this.enableNamespace(namespace);
      return;
    }
    this.disableNamespace(namespace);
  }

  isNamespaceEnabled(namespace: string): boolean {
    return !this.disabledNamespaces.has(normalizeNamespace(namespace));
  }

  clearNamespaceFilters(): void {
    this.disabledNamespaces.clear();
    this.persistRuntimeSettings();
    this.notifyListeners();
  }

  getDisabledNamespaces(): string[] {
    return [...this.disabledNamespaces].sort((a, b) => a.localeCompare(b));
  }

  getKnownNamespaces(): string[] {
    return [...this.knownNamespaces].sort((a, b) => a.localeCompare(b));
  }

  getStreamEntries(): DebugStreamEntry[] {
    return [...this.stream];
  }

  clearStream(): void {
    this.stream.length = 0;
    this.notifyListeners();
  }

  getStreamText(): string {
    return this.stream.map((entry) => entry.line).join("\n");
  }

  setStreamLimit(limit: number): void {
    this.streamLimit = Math.max(100, Math.round(limit));
    if (this.stream.length > this.streamLimit) {
      this.stream.splice(0, this.stream.length - this.streamLimit);
    }
    this.notifyListeners();
  }
}

export const debugLog = new DebugLogger();

export const logTimeConversion = (
  operation: string,
  originalTime: string | Date,
  convertedTime: string | Date,
  timezone?: string,
  context?: DebugContext
) =>
  debugLog.logTimeConversion(
    operation,
    originalTime,
    convertedTime,
    timezone,
    context
  );

export const logComponentLifecycle = (
  component: string,
  lifecycle: string,
  data?: unknown,
  context?: DebugContext
) => debugLog.componentLifecycle(component, lifecycle, data, context);

export const logApiCall = (
  method: string,
  url: string,
  status: "start" | "success" | "error",
  context?: DebugContext,
  data?: unknown
) => debugLog.apiCall(method, url, status, context, data);

export const debugGroup = (label: string, callback: () => void) =>
  debugLog.group(label, callback);

export const isDebugEnabled = () => debugLog.isEnabled();
export const setDebugEnabled = (enabled: boolean) =>
  debugLog.setEnabled(enabled);
export const getLogLevel = () => debugLog.getLevel();
export const setLogLevel = (level: RuntimeLogLevel) => debugLog.setLevel(level);

export default debugLog;
