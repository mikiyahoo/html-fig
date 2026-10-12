"use client";

import { useState } from "react";
import type { CaptureStatus, CaptureResult } from "@/lib/types";
import { X, Download, FileJson, Loader2, AlertCircle, CheckCircle, ExternalLink, Copy, Check, Clock, Link2, Info, ChevronRight, ArrowLeft, Globe2 } from "lucide-react";

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
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!figmaImportUrl) return;
    navigator.clipboard.writeText(figmaImportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInFigma = async () => {
    window.open("https://www.figma.com/files", "_blank", "noopener,noreferrer");
    setShowFigmaInstructions(true);
    setFigmaImportUrl(null);
    setFigmaLinkError(null);
    setIsPreparingFigma(true);
    setCopied(false);
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
    const totalElements = results.reduce((count, capture) => count + capture.elements.length, 0);
    const totalAssets = results.reduce((count, capture) => count + capture.assets.length, 0);
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Breadcrumb — outside the card ── */}
        <button
          onClick={() => { onStatusChange(null); onResultChange(null); }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          My Projects
        </button>

        {/* ── Main card — contains everything below the breadcrumb ── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* Card header: title + URL + DONE + X */}
          <div className="px-7 py-5 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {results.length > 1 ? `${results.length} Pages Captured` : "Capture complete"}
              </h1>
              <p className="text-sm text-gray-400 mt-1">{r.originalUrl}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">
                <CheckCircle className="w-4 h-4" />
                DONE
              </span>
              <button
                onClick={() => { onStatusChange(null); onResultChange(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Preview panel */}
          <div className="relative mx-6 mb-6 rounded-xl border border-gray-200 overflow-hidden bg-white" style={{ minHeight: 290 }}>
            {/* Quick-action buttons top-right */}
            <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-2">
              <a
                href={`/api/captures/${r.id}/screenshot`}
                download={`capture-${r.id}.png`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                DOWNLOAD PNG
              </a>
              <button
                type="button"
                onClick={() => setShowJson(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <FileJson className="w-3.5 h-3.5" />
                FIGMA JSON
              </button>
            </div>

            <div className="flex min-h-[290px]">
              {/* Left sidebar */}
              <aside className="w-44 shrink-0 border-r border-gray-100 py-4 px-3 space-y-0.5">
                {results.map((capture, idx) => (
                  <div key={capture.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-default ${idx === 0 ? "text-gray-900 bg-gray-50" : "text-gray-500"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {idx === 0 && <Globe2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                      <span className="truncate">{capture.pageMetadata.title || capture.captureSettings.viewport.toUpperCase()}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  </div>
                ))}
                {results.length === 1 && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2.5 text-xs text-gray-400">
                      <span>Desktop</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-200 shrink-0" />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 text-xs text-gray-400">
                      <span>Mobile</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-200 shrink-0" />
                    </div>
                  </>
                )}
              </aside>

              {/* Screenshot + Developer Note */}
              <div className="flex-1 relative flex items-center justify-center p-8 bg-gray-50/60">
                <div className="rounded-lg overflow-hidden shadow border border-gray-200 bg-white flex items-center max-h-60">
                  <img
                    src={`/api/captures/${r.id}/screenshot`}
                    alt="Captured page screenshot"
                    className="max-h-60 w-auto object-contain"
                  />
                </div>

                {/* Developer Note — always visible */}
                <div className="absolute bottom-4 right-4 w-52 bg-amber-50 border border-amber-200 rounded-xl p-3.5 shadow">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-bold text-amber-800">Developer Note</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    {captureWarnings.length > 0
                      ? captureWarnings[0]
                      : browserErrors.length > 0
                        ? browserErrors[0]
                        : `Capture completed at ${r.pageMetadata.viewportWidth}×${r.pageMetadata.scrollHeight}px. All elements are ready for Figma import.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row — 4 separated bordered boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 mb-5">
            {[
              { value: totalElements, label: "Elements" },
              { value: totalAssets, label: "Assets" },
              { value: r.pageMetadata.viewportWidth, label: "Viewport width" },
              { value: r.pageMetadata.scrollHeight, label: "Scroll height" },
            ].map(({ value, label }) => (
              <div key={label} className="border border-gray-200 rounded-xl py-5 text-center">
                <div className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Status banners */}
          {(status?.errors.length || browserErrors.length > 1) ? (
            <div className="px-6 pb-4 space-y-2">
              {status?.errors.length ? (
                <div className="warning-card text-sm">
                  <p className="font-medium mb-1">Some pages could not be captured:</p>
                  <ul className="list-disc list-inside space-y-0.5">{status.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              ) : null}
              {browserErrors.length > 1 && (
                <div className="error-card text-sm">
                  <p className="font-medium mb-1">Browser diagnostics ({browserErrors.length}):</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">{browserErrors.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              )}
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 px-6 pb-6">
            <button
              type="button"
              onClick={openInFigma}
              className="flex-1 inline-flex justify-center items-center gap-2 px-5 py-3.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Figma
            </button>
            <a
              href={batchExportUrl || `/api/captures/${r.id}/export`}
              download
              className="flex-1 inline-flex justify-center items-center gap-2 px-5 py-3.5 bg-white text-gray-700 font-medium text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4 text-gray-500" />
              {batchExportUrl ? "Download Website Package" : "Download Capture Package"}
            </a>
            <button
              type="button"
              onClick={() => setShowJson(true)}
              className="flex-1 inline-flex justify-center items-center gap-2 px-5 py-3.5 bg-white text-gray-700 font-medium text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <FileJson className="w-4 h-4 text-gray-500" />
              View JSON
            </button>
          </div>
        </div>

        {/* ── Figma Instructions Modal ── */}
        {showFigmaInstructions && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Open this capture in Figma"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setShowFigmaInstructions(false)}
          >
            <section
              className="w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm">
                    <svg width="24" height="36" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
                      <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
                      <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
                      <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
                      <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
                      <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
                    </svg>
                  </div>
                  <div className="h-9 w-[1px] bg-slate-200 shrink-0 mx-1" />
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Create an editable Figma design</h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Follow these steps to open the design in Figma and make it editable.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFigmaInstructions(false)}
                  aria-label="Close Figma instructions"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="mb-6 space-y-3.5">
                {[
                  { step: 1, content: <>In the Figma tab, open a Figma <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">Design</span> document.</> },
                  { step: 2, content: <>Launch <span className="inline-block rounded-md bg-blue-50/80 border border-blue-100/60 px-2 py-0.5 text-xs font-bold text-blue-900">Web to Figma Importer</span> from <span className="font-bold text-slate-900">Plugins → Development</span>.</> },
                  { step: 3, content: <>Paste the secure transfer link below into the plugin and choose <span className="font-bold text-slate-900">Create Editable Design</span>.</> },
                  { step: 4, content: <>When the editable layers appear, use <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">File → Save local copy</span> in Figma to download a genuine <code className="font-mono text-xs">.fig</code> file.</> },
                ].map(({ step, content }) => (
                  <div key={step} className="flex items-center gap-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">{step}</span>
                    <p className="text-sm text-slate-700">{content}</p>
                  </div>
                ))}
              </div>

              <div className="mb-4 rounded-2xl border border-blue-100/80 bg-blue-50/40 p-4 sm:p-5">
                <div className="mb-3.5 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100/70 text-blue-600">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-900">Transfer link</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                      <Clock className="h-3 w-3" />
                      Expires in 30 minutes
                    </span>
                  </div>
                </div>
                {isPreparingFigma && (
                  <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Preparing a private transfer link…
                  </div>
                )}
                {figmaLinkError && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{figmaLinkError}</p>
                )}
                {figmaImportUrl && (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      id="figma-import-url"
                      readOnly
                      value={figmaImportUrl}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-700 shadow-sm outline-none select-all focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all shrink-0"
                    >
                      {copied ? <><Check className="h-4 w-4" />Copied</> : <><Copy className="h-4 w-4" />Copy</>}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 sm:p-4 text-xs leading-relaxed text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">i</span>
                <p className="flex-1">This link is only for the Figma plugin to fetch this capture package. The ZIP download remains available as a secondary import option.</p>
              </div>
            </section>
          </div>
        )}

        {/* ── JSON Modal ── */}
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
