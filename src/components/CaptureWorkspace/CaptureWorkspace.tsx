"use client";

import { useState } from "react";
import type { CaptureStatus, CaptureResult } from "@/lib/types";
import { X, Download, FileJson, Loader2, AlertCircle, CheckCircle, ExternalLink, Copy } from "lucide-react";

interface CaptureWorkspaceProps {
  status: CaptureStatus | null;
  result: CaptureResult | null;
  results: CaptureResult[];
  batchExportUrl: string | null;
  onStatusChange: (status: CaptureStatus | null) => void;
  onResultChange: (result: CaptureResult | null) => void;
}

export default function CaptureWorkspace({ status, result, results, batchExportUrl, onStatusChange, onResultChange }: CaptureWorkspaceProps) {
  const [isCapturing] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showFigmaInstructions, setShowFigmaInstructions] = useState(false);
  const [figmaImportUrl, setFigmaImportUrl] = useState<string | null>(null);
  const [figmaLinkError, setFigmaLinkError] = useState<string | null>(null);
  const [isPreparingFigma, setIsPreparingFigma] = useState(false);

  const openInFigma = async () => {
    window.open("https://www.figma.com/files", "_blank", "noopener,noreferrer");
    setShowFigmaInstructions(true);
    setFigmaImportUrl(null);
    setFigmaLinkError(null);
    setIsPreparingFigma(true);
    try {
      const response = await fetch("/api/figma/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captureIds: results.map((capture) => capture.id) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not prepare the Figma transfer link.");
      setFigmaImportUrl(payload.importUrl as string);
    } catch (error) {
      setFigmaLinkError(error instanceof Error ? error.message : "Could not prepare the Figma transfer link.");
    } finally {
      setIsPreparingFigma(false);
    }
  };

  if (isCapturing || status?.state === "running" || status?.state === "pending") {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Capturing Website</h2>
              <span className="status-badge" data-status="loading">
                <Loader2 className="w-3 h-3 animate-spin" />
                {status?.progress || "Starting..."}
              </span>
            </div>
            <div className="space-y-3">
              <div className="skeleton h-8 w-full"></div>
              <div className="skeleton h-8 w-2/3"></div>
              <div className="skeleton h-8 w-1/2"></div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Chromium is rendering the page. This may take a moment depending on the website.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status?.state === "failed" && !result) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Capture Failed</h2>
              <span className="status-badge" data-status="error">
                <AlertCircle className="w-3 h-3" />
                Failed
              </span>
            </div>
            <div className="error-card">
              <p className="font-medium mb-1">The capture could not be completed:</p>
              <ul className="list-disc list-inside space-y-1">
                {status.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => { onStatusChange(null); onResultChange(null); }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const r = result!;
    const browserErrors = results.flatMap((capture) => capture.errors.map((message) => `${capture.captureSettings.viewport}: ${message}`));
    const captureWarnings = results.flatMap((capture) => capture.warnings);
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {results.length > 1 ? `${results.length} Page Layouts Captured` : "Capture Complete"}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{r.originalUrl}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="status-badge" data-status="success">
                <CheckCircle className="w-3 h-3" />
                Done
              </span>
              <button
                onClick={() => { onStatusChange(null); onResultChange(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={`/api/captures/${r.id}/screenshot`}
                alt="Captured page"
                className="w-full max-h-96 object-contain"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{results.reduce((count, capture) => count + capture.elements.length, 0)}</div>
                <div className="text-xs text-gray-500">Elements</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{results.reduce((count, capture) => count + capture.assets.length, 0)}</div>
                <div className="text-xs text-gray-500">Assets</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{r.pageMetadata.viewportWidth}</div>
                <div className="text-xs text-gray-500">Viewport W</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{r.pageMetadata.scrollHeight}</div>
                <div className="text-xs text-gray-500">Scroll H</div>
              </div>
            </div>

            {results.length > 1 && (
              <section className="rounded-lg border border-gray-200">
                <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">Pages in this package</h3>
                <ul className="divide-y divide-gray-100">
                  {results.map((capture) => (
                    <li key={capture.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-gray-900">{capture.pageMetadata.title || capture.originalUrl}</span>
                      <span className="break-all text-xs text-gray-500">{capture.originalUrl} · {capture.captureSettings.viewport}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {status?.errors.length ? (
              <div className="warning-card">
                <p className="mb-1 font-medium">Some pages could not be captured:</p>
                <ul className="list-disc list-inside space-y-1">
                  {status.errors.map((message, index) => <li key={index}>{message}</li>)}
                </ul>
              </div>
            ) : null}

            {browserErrors.length > 0 && (
              <div className="error-card">
                <p className="mb-1 font-medium">Browser console diagnostics ({browserErrors.length}):</p>
                <ul className="list-disc list-inside space-y-1">
                  {browserErrors.slice(0, 8).map((message, index) => <li key={index}>{message}</li>)}
                  {browserErrors.length > 8 && <li>... and {browserErrors.length - 8} more</li>}
                </ul>
              </div>
            )}

            {captureWarnings.length > 0 && (
              <div className="warning-card">
                <p className="font-medium mb-1">Warnings ({captureWarnings.length}):</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {captureWarnings.slice(0, 5).map((w, i) => (<li key={i}>{w}</li>))}
                  {captureWarnings.length > 5 && <li>... and {captureWarnings.length - 5} more</li>}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={openInFigma}
                className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Figma
              </button>
              <a
                href={batchExportUrl || `/api/captures/${r.id}/export`}
                download
                className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                {batchExportUrl ? "Download Website Package" : "Download Capture Package"}
              </a>
              <button type="button" onClick={() => setShowJson(true)} className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <FileJson className="w-4 h-4" />
                View JSON
              </button>
            </div>
            {showFigmaInstructions && (
              <div role="dialog" aria-modal="true" aria-label="Open this capture in Figma" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowFigmaInstructions(false)}>
                <section className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
                  <header className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Create an editable Figma design</h3>
                    <button type="button" onClick={() => setShowFigmaInstructions(false)} aria-label="Close Figma instructions" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                  </header>
                  <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
                    <li>In the Figma tab, open a Figma <b>Design</b> document.</li>
                    <li>Launch <b>Web to Figma Importer</b> from <b>Plugins → Development</b>.</li>
                    <li>Paste the secure transfer link below into the plugin and choose <b>Create Editable Design</b>.</li>
                    <li>When the editable layers appear, use <b>File → Save local copy</b> in Figma to download a genuine <code>.fig</code> file.</li>
                  </ol>
                  {isPreparingFigma && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Preparing a private transfer link…</p>}
                  {figmaLinkError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{figmaLinkError}</p>}
                  {figmaImportUrl && (
                    <div className="space-y-2">
                      <label htmlFor="figma-import-url" className="block text-sm font-medium text-gray-700">Transfer link · expires in 30 minutes</label>
                      <div className="flex gap-2">
                        <input id="figma-import-url" readOnly value={figmaImportUrl} className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-xs" />
                        <button type="button" onClick={() => navigator.clipboard.writeText(figmaImportUrl)} className="inline-flex items-center gap-1 rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"><Copy className="h-4 w-4" /> Copy</button>
                      </div>
                    </div>
                  )}
                  <p className="mt-4 text-xs text-gray-500">This link is only for the Figma plugin to fetch this capture package. The ZIP download remains available as a secondary import option.</p>
                </section>
              </div>
            )}
            {showJson && (
              <div role="dialog" aria-modal="true" aria-label="Capture JSON" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowJson(false)}>
                <section className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
                  <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h3 className="font-semibold text-gray-900">Capture JSON</h3>
                    <button type="button" onClick={() => setShowJson(false)} aria-label="Close JSON" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                  </header>
                  <pre className="overflow-auto p-5 text-xs text-gray-800">{JSON.stringify(results.length > 1 ? results : r, null, 2)}</pre>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Capture Workspace</h2>
          <p className="text-gray-500 mb-6">Enter a URL above to start capturing. The captured page will appear here.</p>
          <p className="text-sm text-gray-400">This is a functional implementation - Chromium renders the actual page.</p>
        </div>
      </div>
    </div>
  );
}
