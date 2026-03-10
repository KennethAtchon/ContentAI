"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { debugLog } from "@/shared/utils/debug";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle } from "lucide-react";
import { IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Enhanced error logging with location details
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      location: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    debugLog.error("ErrorBoundary caught an error:", errorDetails);

    // In development, log additional details using debugLog
    if (IS_DEVELOPMENT) {
      debugLog.error("🚨 ErrorBoundary Error Details", {
        error: error.message,
        errorInfo: errorInfo,
        componentStack: errorInfo.componentStack,
        location: window.location.href,
        stack: error.stack,
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorBoundaryContent
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Enhanced error boundary content with development details and cute production messages
 */
function ErrorBoundaryContent({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  // Cute dog messages for production
  const dogMessages = [
    "🐕 Oops! Even the best dogs sometimes trip over their own paws!",
    "🦴 Woof! Something went wrong, but don't worry - we're on it!",
    "🐾 Our coding doggo is confused! Let's try that again.",
    "🐶 Sit. Stay. Refresh the page. Good human!",
    "🦮 Lead developer is investigating! (Probably napping, but still...)",
  ];

  const randomDogMessage =
    dogMessages[Math.floor(Math.random() * dogMessages.length)];

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>
              {IS_DEVELOPMENT
                ? "Development Error"
                : "Oops! Something went wrong"}
            </CardTitle>
          </div>
          <CardDescription>
            {IS_DEVELOPMENT
              ? "An error occurred in development. Check the details below."
              : randomDogMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {IS_DEVELOPMENT && error && (
            <div className="space-y-3">
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm font-semibold text-destructive mb-2">
                  Error Message:
                </p>
                <p className="text-sm font-mono text-destructive">
                  {error.message}
                </p>
              </div>

              {error.stack && (
                <div className="rounded-md bg-muted p-3 max-h-32 overflow-y-auto">
                  <p className="text-sm font-semibold mb-2">Stack Trace:</p>
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
              )}

              <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm font-semibold text-blue-800 mb-1">
                  Debug Info:
                </p>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>
                    <strong>Location:</strong> {window.location.href}
                  </p>
                  <p>
                    <strong>Time:</strong> {new Date().toLocaleString()}
                  </p>
                  <p>
                    <strong>User Agent:</strong>{" "}
                    {navigator.userAgent.split(" ")[0]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!IS_DEVELOPMENT && (
            <div className="text-center space-y-3">
              <div className="text-4xl">🐕‍🦺</div>
              <p className="text-sm text-muted-italic">{randomDogMessage}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onReset} variant="outline" className="flex-1">
              Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="default"
              className="flex-1"
            >
              Refresh Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
