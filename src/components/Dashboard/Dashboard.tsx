"use client";

import type { CaptureStatus } from "@/lib/types";
import { ArrowRight, ExternalLink } from "lucide-react";

interface DashboardProps {
  onNavigateToCapture: () => void;
  onViewCapture: (captureId: string, batchId?: string) => void;
  recentCaptures: CaptureStatus[];
}

export default function Dashboard({ onNavigateToCapture, onViewCapture, recentCaptures }: DashboardProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Web to Figma</h1>
          <p className="text-gray-500 mt-1">
            Convert any website into editable Figma design layers
          </p>
        </div>
        <button
          onClick={onNavigateToCapture}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus-ring"
        >
          <ArrowRight className="w-4 h-4" />
          Import Website
        </button>
      </div>

      {/* Recent captures */}
      {recentCaptures.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Recent Capture Projects</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {recentCaptures.map((capture) => (
              <li key={capture.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 truncate max-w-md">{capture.originalUrl}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {capture.state} - {new Date(capture.completedAt || capture.startedAt || "").toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => onViewCapture(capture.id, capture.batchId)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View <ExternalLink className="w-3 h-3 inline ml-1" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Empty state */}
      {recentCaptures.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
          <div className="empty-state-icon">
            <svg className="w-full h-full text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No captures yet</h3>
          <p className="text-gray-500 mb-4 max-w-md">
            Enter a website URL above to capture and convert it into editable design layers.
            Your first capture will appear here for future reference.
          </p>
          <button
            onClick={onNavigateToCapture}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            Import Your First Website
          </button>
        </div>
      )}
    </div>
  );
}
