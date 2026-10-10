"use client";

import { useState } from "react";
import type { CaptureInput, Viewport } from "@/lib/url-validator";
import { validateUrl, VIEWPORT_LABELS } from "@/lib/url-validator";
import { Loader2, AlertCircle } from "lucide-react";

interface ImportPanelProps {
  onImport: (input: Omit<CaptureInput, "url"> & { urls: string[]; viewports: Viewport[] }) => void;
  disabled: boolean;
  error?: string;
  progress?: string;
}

export default function ImportPanel({ onImport, disabled, error, progress }: ImportPanelProps) {
  const [url, setUrl] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [responsiveLayouts, setResponsiveLayouts] = useState(false);
  const [fullPageScreenshot, setFullPageScreenshot] = useState(false);
  const [captureAssets, setCaptureAssets] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveredPages, setDiscoveredPages] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleDiscover = async () => {
    setValidationError(null);
    setDiscoveryError(null);
    const validation = validateUrl(url);
    if (!validation.valid || !validation.parsedUrl) {
      setValidationError(validation.error || "Invalid URL");
      return;
    }

    setIsDiscovering(true);
    try {
      const response = await fetch("/api/captures/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: validation.parsedUrl.href }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.details || payload.error || "Could not discover pages");
      const pages = payload.pages as string[];
      setDiscoveredPages(pages);
      setSelectedPages(pages);
      setUrl(validation.parsedUrl.href);
    } catch (err) {
      setDiscoveryError((err as Error).message);
      setDiscoveredPages([]);
      setSelectedPages([]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const validation = validateUrl(url);
    if (!validation.valid) {
      setValidationError(validation.error || "Invalid URL");
      return;
    }
    if (!selectedPages.length) {
      setDiscoveryError("Discover pages and select at least one page to import.");
      return;
    }

    onImport({
      urls: selectedPages,
      viewport,
      viewports: responsiveLayouts ? ["desktop", "tablet", "mobile"] : [viewport],
      fullPageScreenshot,
      captureAssets,
      captureSchemaVersion: 1,
    });
  };

  const responsivePageLimitReached = responsiveLayouts && selectedPages.length > 3;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-2xl mx-auto"
    >
      <div className="p-6 space-y-6">
        {/* URL Input */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Website URL
          </label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setDiscoveredPages([]);
              setSelectedPages([]);
              setDiscoveryError(null);
            }}
            placeholder="https://example.com"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus-ring"
            disabled={disabled}
            autoComplete="off"
          />
          {validationError && (
            <p className="mt-2 flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {validationError}
            </p>
          )}
          {error && !validationError && (
            <p className="mt-2 flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleDiscover}
            disabled={disabled || isDiscovering}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {isDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isDiscovering ? "Finding pages…" : "Find pages on this website"}
          </button>
          {discoveryError && <p className="text-sm text-red-600">{discoveryError}</p>}
          {discoveredPages.length > 0 && (
            <fieldset className="rounded-lg border border-gray-200 p-4">
              <legend className="px-1 text-sm font-medium text-gray-700">Choose pages ({selectedPages.length} selected)</legend>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {discoveredPages.map((page) => (
                  <label key={page} className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedPages.includes(page)}
                      onChange={(event) => setSelectedPages((current) => event.target.checked
                        ? [...current, page]
                        : current.filter((selected) => selected !== page))}
                      disabled={disabled}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="break-all">{page}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Viewport */}
          <div>
            <label htmlFor="viewport" className="block text-sm font-medium text-gray-700 mb-2">
              Viewport
            </label>
            <select
              id="viewport"
              value={viewport}
              onChange={(e) => setViewport(e.target.value as Viewport)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus-ring"
              disabled={disabled || responsiveLayouts}
            >
              {(Object.keys(VIEWPORT_LABELS) as Viewport[]).map((v) => (
                <option key={v} value={v}>
                  {VIEWPORT_LABELS[v]}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
            <input
              id="responsiveLayouts"
              type="checkbox"
              checked={responsiveLayouts}
              onChange={(event) => setResponsiveLayouts(event.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={disabled}
            />
            <span>
              <span className="block text-sm font-medium text-gray-700">Capture responsive layouts</span>
              <span className="block text-xs text-gray-500">Creates desktop, tablet, and mobile frames. Select up to 3 pages per responsive import.</span>
            </span>
          </label>

          {/* Full Page Screenshot */}
          <div className="flex items-center justify-between">
            <label htmlFor="fullPageScreenshot" className="text-sm font-medium text-gray-700">
              Full Page Screenshot
            </label>
            <input
              id="fullPageScreenshot"
              type="checkbox"
              checked={fullPageScreenshot}
              onChange={(e) => setFullPageScreenshot(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={disabled}
            />
          </div>
        </div>

        {responsivePageLimitReached && (
          <p role="alert" className="text-sm text-amber-700">Responsive imports are limited to 3 pages per batch. Deselect {selectedPages.length - 3} page(s) to continue.</p>
        )}

        {/* Capture Assets */}
        <div className="flex items-center justify-between">
          <label htmlFor="captureAssets" className="text-sm font-medium text-gray-700">
            Capture Assets
          </label>
          <input
            id="captureAssets"
            type="checkbox"
            checked={captureAssets}
            onChange={(e) => setCaptureAssets(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={disabled}
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={disabled || selectedPages.length === 0 || responsivePageLimitReached}
            className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disabled ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Import {selectedPages.length || "Selected"} Page{selectedPages.length === 1 ? "" : "s"}{responsiveLayouts ? " · 3 sizes" : ""}
              </>
            )}
          </button>
        </div>

        {/* Progress */}
        {progress && (
          <div className="pt-3 border-t border-gray-100">
            <div className="capture-progress">
              <div className="capture-progress-step" data-state="active">
                <span className="step-number">1</span>
                <span className="text-sm font-medium text-gray-700">{progress}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
