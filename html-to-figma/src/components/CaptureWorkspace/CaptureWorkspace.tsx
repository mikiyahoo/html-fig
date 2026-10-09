"use client";

import { useState } from "react";
import type { CaptureStatus, CaptureResult } from "@/lib/types";
import { X, Download, FileJson, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface CaptureWorkspaceProps {
  status: CaptureStatus | null;
  result: CaptureResult | null;
  onStatusChange: (status: CaptureStatus | null) => void;
  onResultChange: (result: CaptureResult | null) => void;
}

export default function CaptureWorkspace({ status, result, onStatusChange, onResultChange }: CaptureWorkspaceProps) {
  const [isCapturing] = useState(false);

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

  if (result) {
    const r = result!;
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Capture Complete</h2>
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
                <div className="text-2xl font-bold text-gray-900">{r.elements.length}</div>
                <div className="text-xs text-gray-500">Elements</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{r.assets.length}</div>
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

            {r.warnings.length > 0 && (
              <div className="warning-card">
                <p className="font-medium mb-1">Warnings ({r.warnings.length}):</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {r.warnings.slice(0, 5).map((w, i) => (<li key={i}>{w}</li>))}
                  {r.warnings.length > 5 && <li>... and {r.warnings.length - 5} more</li>}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => window.open(`/api/captures/${r.id}/export`, "_blank")}
              >
                <Download className="w-4 h-4" />
                Download Capture Package
              </button>
              <button className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <FileJson className="w-4 h-4" />
                View JSON
              </button>
            </div>
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
  }