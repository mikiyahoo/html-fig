"use client";

import { useState } from "react";
import Dashboard from "@/components/Dashboard/Dashboard";
import ImportPanel from "@/components/ImportPanel/ImportPanel";
import CaptureWorkspace from "@/components/CaptureWorkspace/CaptureWorkspace";
import type { CaptureStatus, CaptureResult, CaptureState } from "@/lib/types";

export default function Home() {
  const [view, setView] = useState<"dashboard" | "import" | "capture">("dashboard");
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleImport = async (input: {
    url: string;
    viewport: "desktop" | "tablet" | "mobile";
    fullPageScreenshot: boolean;
    captureAssets: boolean;
    captureSchemaVersion: number;
  }) => {
    setView("capture");
    setIsCapturing(true);
    setError(undefined);

    setStatus({
      id: "temp",
      originalUrl: input.url,
      state: "running",
      progress: "Starting capture...",
      errors: [],
      warnings: [],
      screenshotUrl: null,
      elapsedTime: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    try {
      const response = await fetch("/api/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.details || payload.error || "Capture failed");
      const captureResult = payload as CaptureResult;

      setResult(captureResult);
      setStatus({
        id: captureResult.id,
        originalUrl: captureResult.originalUrl,
        state: "completed" as CaptureState,
        progress: "Complete",
        errors: captureResult.errors,
        warnings: captureResult.warnings,
        screenshotUrl: `/api/captures/${captureResult.id}/screenshot`,
        elapsedTime: 0,
        startedAt: captureResult.captureTimestamp,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError((err as Error).message);
      setStatus({
        id: "temp",
        originalUrl: input.url,
        state: "failed",
        progress: "Failed",
        errors: [(err as Error).message],
        warnings: [],
        screenshotUrl: null,
        elapsedTime: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <Dashboard
        onNavigateToCapture={() => setView("import")}
        recentCaptures={status ? [status] : []}
      />

      {view === "import" && !isCapturing && !result && (
        <ImportPanel
          onImport={handleImport}
          disabled={isCapturing}
          error={error}
          progress={isCapturing ? status?.progress : undefined}
        />
      )}

      {view === "capture" && (
        <CaptureWorkspace
          status={status}
          result={result}
          onStatusChange={setStatus}
          onResultChange={setResult}
        />
      )}
    </main>
  );
}
