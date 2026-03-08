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
    debugLog.error("ErrorBoundary caught an error:", { error, errorInfo });
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
 * Error boundary content component with hardcoded English strings.
 * Intentionally not translated - if users see this, something is critically broken.
 */
function ErrorBoundaryContent({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An unexpected error occurred. Please try again or refresh the page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {IS_DEVELOPMENT && error && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-mono text-destructive">
                {error.message}
              </p>
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
