"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard/Dashboard";
import ImportPanel from "@/components/ImportPanel/ImportPanel";
import CaptureWorkspace from "@/components/CaptureWorkspace/CaptureWorkspace";
import type { CaptureResult, CaptureStatus } from "@/lib/types";
import type { Viewport } from "@/lib/url-validator";

type CaptureOptions = {
  viewport: "desktop" | "tablet" | "mobile";
  viewports: Array<"desktop" | "tablet" | "mobile">;
  fullPageScreenshot: boolean;
  captureAssets: boolean;
  captureSchemaVersion: number;
};

export default function Home() {
  const [view, setView] = useState<"dashboard" | "import" | "capture">("dashboard");
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [recentCaptures, setRecentCaptures] = useState<CaptureStatus[]>([]);
  const [captures, setCaptures] = useState<CaptureResult[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [initialUrl, setInitialUrl] = useState("");
  const [initialViewport, setInitialViewport] = useState<Viewport>("desktop");

  useEffect(() => {
    fetch("/api/captures")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load recent captures")))
      .then((payload) => setRecentCaptures(payload.captures as CaptureStatus[]))
      .catch(() => setRecentCaptures([]));
  }, []);

  const handleImport = async (input: CaptureOptions & { urls: string[] }) => {
    setView("capture");
    setIsLoading(true);
    setError(undefined);
    setCaptures([]);
    setBatchId(null);
    setStatus({
      id: "pending",
      originalUrl: input.urls[0] || "",
      state: "running",
      progress: `Capturing ${input.urls.length * input.viewports.length} page layout(s)…`,
      errors: [],
      warnings: [],
      screenshotUrl: null,
      elapsedTime: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    try {
      const response = await fetch("/api/captures/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await readBatchResponse(response, (progress) => {
        setStatus((current) => current ? { ...current, progress } : current);
      });

      const imported = payload.captures as CaptureResult[];
      if (!imported.length) throw new Error("No selected pages were captured.");
      setCaptures(imported);
      setBatchId(payload.batchId as string);
      const first = imported[0];
      const failures = (payload.failures || []) as Array<{ url: string; error: string }>;
      setStatus({
        id: first.id,
        batchId: payload.batchId,
        originalUrl: first.originalUrl,
        state: "completed",
        progress: `Captured ${imported.length} page layout(s)`,
        errors: failures.map((failure) => `${failure.url}: ${failure.error}`),
        warnings: imported.flatMap((capture) => capture.warnings),
        screenshotUrl: `/api/captures/${first.id}/screenshot`,
        elapsedTime: 0,
        startedAt: first.captureTimestamp,
        completedAt: new Date().toISOString(),
      });
      const recent: CaptureStatus = { id: first.id, batchId: payload.batchId as string, originalUrl: first.originalUrl, state: "completed", progress: `Captured ${imported.length} page layout(s)`, errors: failures.map((failure) => failure.error), warnings: imported.flatMap((capture) => capture.warnings), screenshotUrl: `/api/captures/${first.id}/screenshot`, elapsedTime: 0, startedAt: first.captureTimestamp, completedAt: new Date().toISOString() };
      setRecentCaptures((current) => [
        recent,
        ...current.filter((capture) => capture.batchId !== payload.batchId && capture.id !== first.id),
      ].slice(0, 20));
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      setStatus({
        id: "failed",
        originalUrl: input.urls[0] || "",
        state: "failed",
        progress: "Failed",
        errors: [message],
        warnings: [],
        screenshotUrl: null,
        elapsedTime: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewCapture = async (id: string, savedBatchId?: string) => {
    if (status?.id === id && (!savedBatchId || batchId === savedBatchId) && captures.length) {
      setView("capture");
      return;
    }

    setView("capture");
    setIsLoading(true);
    setError(undefined);
    try {
      const url = savedBatchId ? `/api/captures/batch/${savedBatchId}` : `/api/captures/${id}`;
      let response = await fetch(url, { cache: "no-store" });
      let payload = await response.json();
      if (!response.ok) throw new Error(payload.details || payload.error || "Could not load capture");
      for (let attempt = 0; savedBatchId && (payload.status === "pending" || payload.status === "running") && attempt < 240; attempt += 1) {
        setStatus((current) => current ? { ...current, state: payload.status, progress: payload.progress || "Waiting for a capture worker…" } : current);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        response = await fetch(url, { cache: "no-store" });
        payload = await response.json();
      }
      if (payload.status === "failed") throw new Error(payload.failures?.map((failure: { url: string; error: string }) => `${failure.url}: ${failure.error}`).join("\n") || payload.progress || "Capture failed");
      if (payload.status === "pending" || payload.status === "running") throw new Error("This capture is still running. Open it again in a moment to check its progress.");
      const loaded = (savedBatchId ? payload.captures : [payload]) as CaptureResult[];
      setCaptures(loaded);
      setBatchId(savedBatchId || null);
      const first = loaded[0];
      if (!first) throw new Error("This capture has no saved page data.");
      setStatus({
        id: first.id,
        batchId: savedBatchId,
        originalUrl: first.originalUrl,
        state: "completed",
        progress: `Captured ${loaded.length} page layout(s)`,
        errors: payload.failures?.map((failure: { url: string; error: string }) => `${failure.url}: ${failure.error}`) || [],
        warnings: loaded.flatMap((capture) => capture.warnings),
        screenshotUrl: `/api/captures/${first.id}/screenshot`,
        elapsedTime: 0,
        startedAt: first.captureTimestamp,
        completedAt: first.captureTimestamp,
      });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      setCaptures([]);
      setStatus({
        id,
        batchId: savedBatchId,
        originalUrl: "",
        state: "failed",
        progress: "Failed to load capture",
        errors: [message],
        warnings: [],
        screenshotUrl: null,
        elapsedTime: 0,
        startedAt: null,
        completedAt: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCapture = async (capture: CaptureStatus) => {
    const query = capture.batchId ? `?batchId=${encodeURIComponent(capture.batchId)}` : "";
    const response = await fetch(`/api/captures/${encodeURIComponent(capture.id)}${query}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Could not delete this capture project.");
    }
    setRecentCaptures((current) => current.filter((item) => capture.batchId ? item.batchId !== capture.batchId : item.id !== capture.id));
  };

  return (
    <main className="min-h-screen bg-white">
      {view !== "dashboard" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <button type="button" onClick={() => setView("dashboard")} className="text-sm font-medium text-blue-600 hover:text-blue-800">
            ← Projects
          </button>
        </div>
      )}
      {view === "dashboard" && (
        <Dashboard
          onStartCapture={(url, viewport) => {
            setInitialUrl(url);
            setInitialViewport(viewport);
            setView("import");
          }}
          onViewCapture={handleViewCapture}
          onDeleteCapture={handleDeleteCapture}
          recentCaptures={recentCaptures}
        />
      )}
      {view === "import" && (
        <ImportPanel onImport={handleImport} disabled={isLoading} error={error} progress={isLoading ? status?.progress : undefined} initialUrl={initialUrl} initialViewport={initialViewport} />
      )}
      {view === "capture" && (
        <CaptureWorkspace
          status={status}
          result={captures[0] || null}
          results={captures}
          batchExportUrl={batchId ? `/api/captures/batch/${batchId}/export` : null}
          onStatusChange={setStatus}
          onResultChange={(capture) => setCaptures(capture ? [capture] : [])}
        />
      )}
    </main>
  );
}

type BatchResponse = {
  batchId: string;
  captures: CaptureResult[];
  failures?: Array<{ url: string; error: string }>;
  exportUrl?: string;
};

async function readBatchResponse(response: Response, onProgress: (progress: string) => void): Promise<BatchResponse> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.details || payload.error || "Capture failed");
  }

  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    const payload = await response.json() as BatchResponse & { status?: string; progress?: string };
    if (!response.ok) throw new Error((payload as unknown as { details?: string; error?: string }).details || (payload as unknown as { error?: string }).error || "Capture failed");
    if (payload.status !== "pending" && payload.status !== "running") return payload;
    if (!payload.batchId) throw new Error("The queued capture did not return a batch ID.");
    for (let attempt = 0; attempt < 240; attempt += 1) {
      onProgress(payload.progress || "Waiting for a capture worker…");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const statusResponse = await fetch(`/api/captures/batch/${payload.batchId}`, { cache: "no-store" });
      const status = await statusResponse.json() as BatchResponse & { status?: string; progress?: string; details?: string; error?: string };
      if (!statusResponse.ok) throw new Error(status.details || status.error || "Could not check capture progress.");
      onProgress(status.progress || (status.status === "pending" ? "Waiting for a capture worker…" : "Capturing selected pages…"));
      if (status.status === "completed") return status;
      if (status.status === "failed") {
        const failureText = (status.failures || []).map((failure) => `${failure.url}: ${failure.error}`).join("\n");
        throw new Error([status.progress || "All selected page layouts failed.", failureText].filter(Boolean).join("\n"));
      }
    }
    throw new Error("Capture is taking longer than expected. Its status is saved and can be checked from Recent Capture Projects.");
  }

  if (!response.body) throw new Error("The capture stream was empty. Please try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let complete: BatchResponse | undefined;
  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Record<string, unknown>;
    if (event.type === "progress" && typeof event.progress === "string") onProgress(event.progress);
    if (event.type === "error") {
      const failures = Array.isArray(event.failures)
        ? event.failures.map((failure) => `${failure.url}: ${failure.error}`).join("\n")
        : "";
      throw new Error([event.details || event.error || "Capture failed", failures].filter(Boolean).join("\n"));
    }
    if (event.type === "complete") complete = event as unknown as BatchResponse;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) consumeLine(line);
      if (done) break;
    }
    if (pending.trim()) consumeLine(pending);
  } finally {
    reader.releaseLock();
  }
  if (!complete) throw new Error("The capture ended before the package was saved. Please try again.");
  return complete;
}
