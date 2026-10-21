"use client";

import { useState, useEffect } from "react";
import type { CaptureStatus } from "@/lib/types";
import type { CaptureInput, Viewport } from "@/lib/url-validator";
import { validateUrl, VIEWPORT_LABELS } from "@/lib/url-validator";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, ExternalLink, Folder, Globe2, Layers3, LayoutGrid, List, Loader2, Link2, Maximize2, Monitor, MoreHorizontal, Palette, Plus, Search, Settings2, Smartphone, Tablet, Trash2, Upload, WandSparkles, Workflow, X } from "lucide-react";
import FlowRecorder from "@/components/FlowRecorder/FlowRecorder";

interface DashboardProps {
  onImport: (input: Omit<CaptureInput, "url"> & { urls: string[]; viewports: Viewport[] }) => void;
  onViewCapture: (captureId: string, batchId?: string) => void;
  onDeleteCapture: (capture: CaptureStatus) => Promise<void>;
  recentCaptures: CaptureStatus[];
  disabled: boolean;
  error?: string;
  isCapturing?: boolean;
  captureStatus?: CaptureStatus | null;
  showCaptureDrawer?: boolean;
  onCloseCaptureDrawer?: () => void;
}

const viewportIcon = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export default function Dashboard({
  onImport,
  onViewCapture,
  onDeleteCapture,
  recentCaptures,
  disabled,
  error,
  isCapturing = false,
  captureStatus = null,
  showCaptureDrawer = false,
  onCloseCaptureDrawer,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "projects" | "flows">("dashboard");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | "completed" | "running" | "failed">("all");
  const [projectSort, setProjectSort] = useState<"recent" | "oldest" | "name">("recent");
  const [projectViewMode, setProjectViewMode] = useState<"grid" | "list">("grid");
  const [url, setUrl] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [responsiveLayouts, setResponsiveLayouts] = useState(false);
  const [fullPageScreenshot, setFullPageScreenshot] = useState(false);
  const [captureAssets, setCaptureAssets] = useState(true);
  const [discoveredPages, setDiscoveredPages] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [showPagesDrawer, setShowPagesDrawer] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CaptureStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [isViewportOpen, setIsViewportOpen] = useState(false);
  const [isCustomViewport, setIsCustomViewport] = useState(false);
  const [customWidth, setCustomWidth] = useState(1440);
  const [customHeight, setCustomHeight] = useState(900);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const toggleStep = (num: string) => {
    setOpenSteps((prev) => ({
      ...prev,
      [num]: !prev[num],
    }));
  };

  const ViewportIcon = isCustomViewport ? Maximize2 : viewportIcon[viewport];
  const responsiveLimitReached = responsiveLayouts && selectedPages.length > 3;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activeMenuId && !target.closest("[data-card-menu]")) {
        setActiveMenuId(null);
      }
      if (isViewportOpen && !target.closest("[data-viewport-dropdown]")) {
        setIsViewportOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeMenuId, isViewportOpen]);

  const isDrawerOpen = (showCaptureDrawer && isCapturing) || (showPagesDrawer && discoveredPages.length > 0);

  const handleCloseDrawer = () => {
    setShowPagesDrawer(false);
    onCloseCaptureDrawer?.();
  };

  const discoverPages = async () => {
    setDiscoveryError(null);
    const validation = validateUrl(url);
    if (!validation.valid || !validation.parsedUrl) {
      setDiscoveryError(validation.error || "Enter a valid website URL.");
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
      if (!response.ok) throw new Error(payload.details || payload.error || "Could not find website pages.");
      const pages = payload.pages as string[];
      setUrl(validation.parsedUrl.href);
      setDiscoveredPages(pages);
      setSelectedPages(pages);
      if (pages.length) setShowPagesDrawer(true);
      if (!pages.length) setDiscoveryError("No pages were found on this website.");
    } catch (scanError) {
      setDiscoveredPages([]);
      setSelectedPages([]);
      setDiscoveryError(scanError instanceof Error ? scanError.message : "Could not find website pages.");
    } finally {
      setIsDiscovering(false);
    }
  };

  const submitImport = () => {
    if (!selectedPages.length || responsiveLimitReached) return;
    onImport({
      urls: selectedPages,
      viewport,
      viewports: responsiveLayouts ? ["desktop", "tablet", "mobile"] : [viewport],
      fullPageScreenshot,
      captureAssets,
      captureSchemaVersion: 1,
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteCapture(pendingDelete);
      setPendingDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this capture project.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredProjects = recentCaptures.filter((capture) => {
    if (projectStatusFilter !== "all" && capture.state !== projectStatusFilter) {
      return false;
    }
    if (!projectSearch.trim()) return true;
    const query = projectSearch.toLowerCase();
    const urlMatch = capture.originalUrl.toLowerCase().includes(query);
    const titleMatch = (capture.pageTitle || getCardTitle(capture)).toLowerCase().includes(query);
    return urlMatch || titleMatch;
  });

  const sortedAndFilteredProjects = [...filteredProjects].sort((a, b) => {
    if (projectSort === "name") {
      const titleA = (a.pageTitle || getCardTitle(a)).toLowerCase();
      const titleB = (b.pageTitle || getCardTitle(b)).toLowerCase();
      return titleA.localeCompare(titleB);
    }
    if (projectSort === "oldest") {
      const timeA = new Date(a.startedAt || 0).getTime();
      const timeB = new Date(b.startedAt || 0).getTime();
      return timeA - timeB;
    }
    // "recent" (recently updated / newest first)
    const timeA = new Date(a.completedAt || a.startedAt || 0).getTime();
    const timeB = new Date(b.completedAt || b.startedAt || 0).getTime();
    return timeB - timeA;
  });

  const renderCaptureCard = (capture: CaptureStatus, isScrollItem = false) => (
    <article
      key={capture.batchId || capture.id}
      className={`group flex min-h-[300px] ${isScrollItem ? "w-[295px]" : "w-full"} shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      {/* Screenshot / thumbnail with rounded corners */}
      <button
        type="button"
        onClick={() => onViewCapture(capture.id, capture.batchId)}
        className="block w-full overflow-hidden rounded-xl text-left"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-blue-50">
          {capture.screenshotUrl ? (
            <img
              src={capture.screenshotUrl}
              alt={`Preview of ${capture.originalUrl}`}
              loading="lazy"
              className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center text-slate-300">
              <Globe2 className="h-10 w-10" />
            </div>
          )}
        </div>
      </button>

      {/* Card body */}
      <div className="mt-3 flex flex-1 flex-col">
        {/* URL row + menu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
              @
            </span>
            <span className="truncate">{capture.originalUrl}</span>
          </div>
          <div className="relative" data-card-menu>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const id = capture.batchId || capture.id;
                setActiveMenuId(activeMenuId === id ? null : id);
              }}
              aria-label={`Options for ${capture.originalUrl}`}
              aria-expanded={activeMenuId === (capture.batchId || capture.id)}
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {activeMenuId === (capture.batchId || capture.id) && (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[130px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-slate-900/5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    setPendingDelete(capture);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <button
          type="button"
          onClick={() => onViewCapture(capture.id, capture.batchId)}
          className="mt-1.5 block w-full text-left"
        >
          <h3 className="truncate text-sm font-bold text-slate-900 transition group-hover:text-blue-600">
            {getCardTitle(capture)}
          </h3>
        </button>

        {/* Meta — page count & size */}
        <p className="mt-1 text-xs font-medium text-slate-400">
          {getCardMeta(capture)}
        </p>

        {/* Status + time */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          {capture.state === "completed" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 border border-emerald-100/60">
              <Check className="h-3 w-3 stroke-[2.5]" />
              Ready
            </span>
          ) : capture.state === "failed" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 border border-red-100/60">
              <X className="h-3 w-3 stroke-[2.5]" />
              Failed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-100/60">
              <Plus className="h-3 w-3 stroke-[2.5]" />
              Processing
            </span>
          )}
          <span className="text-xs font-normal text-slate-400">
            {formatRelativeDate(capture.completedAt || capture.startedAt)}
          </span>
        </div>
      </div>
    </article>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">

      {/* ── Full-width header (spans sidebar + content) ── */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-7">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Layers3 className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-slate-900">Web to Figma</span>
        </div>

        {/* Right: theme toggle + user profile */}
        <div className="flex items-center gap-1">
          {/* Theme toggle — placeholder */}
          <button
            type="button"
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          </button>

          {/* User profile — placeholder */}
          <button
            type="button"
            aria-label="User menu"
            className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
              MD
            </div>
            <span className="hidden text-sm font-medium text-slate-700 sm:block">Mikias Dereje</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Sidebar + main content row ── */}
      <div className="flex flex-1">

        {/* Sidebar — no logo, just nav. Sticks below the header */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          {/* Nav items */}
          <nav className="flex-1 space-y-0.5 p-3 pt-4">
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                activeTab === "dashboard"
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Layers3 className="h-4 w-4 shrink-0" />
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("projects")}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                activeTab === "projects"
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Folder className="h-4 w-4 shrink-0" />
                My Projects
              </div>
              {recentCaptures.length > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${activeTab === "projects" ? "bg-blue-200/70 text-blue-800" : "bg-slate-100 text-slate-500"}`}>
                  {recentCaptures.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("flows")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                activeTab === "flows"
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Workflow className="h-4 w-4 shrink-0" />
              User Flows
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 transition-colors"
              disabled
            >
              <Palette className="h-4 w-4 shrink-0" />
              Design System
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 transition-colors"
              disabled
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              Settings
            </button>
          </nav>

          {/* Bottom hint */}
          <div className="m-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
              <Globe2 className="h-4 w-4 text-blue-600" />
              From web to Figma
            </div>
            Capture a website, then import its editable layers into Figma.
          </div>
        </aside>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeTab === "flows" ? (
            <FlowRecorder />
          ) : activeTab === "projects" ? (
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-8 lg:py-8">
              {/* Top Navigation */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("dashboard")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("dashboard");
                    setTimeout(() => document.getElementById("website-url")?.focus(), 50);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                >
                  <Plus className="h-4 w-4" /> Import New Website
                </button>
              </div>

              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My Projects</h1>
                  <span className="rounded-full bg-blue-100/70 px-3 py-0.5 text-xs font-bold text-blue-600">
                    {recentCaptures.length} {recentCaptures.length === 1 ? "project" : "projects"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Browse and manage all your converted website projects and Figma assets.
                </p>
              </div>

              {/* Search & Filter Bar with Sort and View Mode */}
              <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search projects by URL or name…"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm"
                  />
                  {projectSearch && (
                    <button
                      type="button"
                      onClick={() => setProjectSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Status filter tabs + Sort + View switcher */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                    {(["all", "completed", "running", "failed"] as const).map((filterKey) => {
                      const label = filterKey === "all" ? "All" : filterKey === "completed" ? "Ready" : filterKey === "running" ? "Processing" : "Failed";
                      const count = filterKey === "all" 
                        ? recentCaptures.length 
                        : recentCaptures.filter((c) => c.state === filterKey).length;
                      const isActive = projectStatusFilter === filterKey;
                      return (
                        <button
                          key={filterKey}
                          type="button"
                          onClick={() => setProjectStatusFilter(filterKey)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            isActive
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {label}
                          <span className={`text-[11px] font-bold ${isActive ? "text-blue-100" : "text-slate-500"}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sort selector */}
                  <div className="relative">
                    <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300">
                      <span className="text-slate-400">Sort:</span>
                      <select
                        value={projectSort}
                        onChange={(e) => setProjectSort(e.target.value as "recent" | "oldest" | "name")}
                        className="cursor-pointer appearance-none bg-transparent pr-4 text-xs font-semibold text-slate-800 outline-none"
                      >
                        <option value="recent">Recently updated</option>
                        <option value="oldest">Oldest first</option>
                        <option value="name">Name (A-Z)</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </label>
                  </div>

                  {/* View Switcher: Grid vs List */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setProjectViewMode("grid")}
                      aria-label="Grid view"
                      className={`rounded-lg p-1.5 transition ${
                        projectViewMode === "grid"
                          ? "bg-blue-50 text-blue-600 shadow-xs"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectViewMode("list")}
                      aria-label="List view"
                      className={`rounded-lg p-1.5 transition ${
                        projectViewMode === "list"
                          ? "bg-blue-50 text-blue-600 shadow-xs"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid or List of Projects */}
              {sortedAndFilteredProjects.length > 0 ? (
                projectViewMode === "grid" ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {sortedAndFilteredProjects.map((capture) => renderCaptureCard(capture, false))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm divide-y divide-slate-100">
                    {sortedAndFilteredProjects.map((capture) => {
                      const id = capture.batchId || capture.id;
                      return (
                        <div
                          key={id}
                          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Left: Thumbnail + Title & URL */}
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onViewCapture(capture.id, capture.batchId)}
                              className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200/60"
                            >
                              {capture.screenshotUrl ? (
                                <img
                                  src={capture.screenshotUrl}
                                  alt={capture.originalUrl}
                                  className="h-full w-full object-cover object-top transition duration-200 group-hover:scale-105"
                                />
                              ) : (
                                <div className="grid h-full place-items-center text-slate-300">
                                  <Globe2 className="h-5 w-5" />
                                </div>
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => onViewCapture(capture.id, capture.batchId)}
                                className="text-left block truncate font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors"
                              >
                                {getCardTitle(capture)}
                              </button>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                <span className="font-mono truncate max-w-xs">{capture.originalUrl}</span>
                                <span>•</span>
                                <span>{getCardMeta(capture)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Status + Time + Actions */}
                          <div className="flex items-center gap-3.5 shrink-0 sm:self-center">
                            {capture.state === "completed" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 border border-emerald-100/60">
                                <Check className="h-3 w-3 stroke-[2.5]" />
                                Ready
                              </span>
                            ) : capture.state === "failed" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 border border-red-100/60">
                                <X className="h-3 w-3 stroke-[2.5]" />
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-100/60">
                                <Plus className="h-3 w-3 stroke-[2.5]" />
                                Processing
                              </span>
                            )}
                            <span className="text-xs text-slate-400 min-w-[65px] text-right">
                              {formatRelativeDate(capture.completedAt || capture.startedAt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onViewCapture(capture.id, capture.batchId)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                              Open <ArrowRight className="h-3 w-3" />
                            </button>
                            <div className="relative" data-card-menu>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === id ? null : id);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {activeMenuId === id && (
                                <div className="absolute right-0 top-full z-30 mt-1 min-w-[130px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-slate-900/5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      setPendingDelete(capture);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-400">
                    <Folder className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">
                    {projectSearch || projectStatusFilter !== "all" ? "No matching projects" : "No projects yet"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    {projectSearch || projectStatusFilter !== "all"
                      ? "Try adjusting your search terms or filters to find what you're looking for."
                      : "Import your first website on the dashboard to see your project files here."}
                  </p>
                  {projectSearch || projectStatusFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => { setProjectSearch(""); setProjectStatusFilter("all"); }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("dashboard");
                        setTimeout(() => document.getElementById("website-url")?.focus(), 50);
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Import your first website
                    </button>
                  )}
                </div>
              )}
              <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-400"><Globe2 className="h-3.5 w-3.5" />Website structure and assets are captured on the server using Playwright.</p>
            </main>
          ) : (
          <main id="dashboard" className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-8 lg:py-8">
          {/* ── Hero ────────────────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-[#0c162c] p-6 sm:p-8 shadow-xl">
            {/* Soft blob decoration */}
            <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-2/3 overflow-hidden">
              <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
              <div className="absolute right-32 bottom-0 h-64 w-80 rounded-full bg-indigo-600/10 blur-2xl" />
            </div>

            {/* Top row: badge + Advanced Settings */}
            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-900/40 px-3 py-1 text-xs font-semibold text-blue-400 shadow-sm">
                Convert Websites to Figma
              </span>
              <button type="button" className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-sm transition hover:bg-slate-700 hover:text-white">
                <Settings2 className="h-3.5 w-3.5" />
                Advanced Settings
              </button>
            </div>

            {/* Two-column layout: left = content, right = illustration */}
            <div className="relative mt-5 flex items-center gap-8">
              {/* Left column */}
              <div className="relative z-10 min-w-0 flex-1">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Web to <span className="text-blue-500">Figma</span>
                </h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                  Turn any website into editable design layers. Capture, convert,<br className="hidden sm:block" /> and open directly in Figma.
                </p>

                {/* URL form — white input & dropdown as requested */}
                <form
                  className="relative z-20 mt-5 flex w-full max-w-4xl flex-col gap-2 rounded-xl border border-white/20 bg-white p-2 shadow-2xl sm:flex-row"
                  onSubmit={(event) => { event.preventDefault(); void discoverPages(); }}
                >
                  <label className="flex min-w-[260px] flex-1 items-center gap-2.5 px-3">
                    <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      id="website-url"
                      type="url"
                      required
                      autoComplete="off"
                      spellCheck={false}
                      disabled={disabled || isDiscovering}
                      value={url}
                      onChange={(event) => { setUrl(event.target.value); setDiscoveredPages([]); setSelectedPages([]); setDiscoveryError(null); }}
                      placeholder="https://example.com"
                      className="h-10 w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]"
                    />
                  </label>
                  {/* Viewport selector */}
                  <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 border-slate-200 px-3 text-sm font-medium text-slate-700 sm:border-l">
                    <ViewportIcon className="h-4 w-4 text-slate-400" />
                    <select
                      aria-label="Viewport size"
                      value={viewport}
                      disabled={disabled || responsiveLayouts}
                      onChange={(event) => setViewport(event.target.value as Viewport)}
                      className="cursor-pointer appearance-none bg-transparent pr-1 text-sm text-slate-800 outline-none disabled:opacity-50"
                    >
                      {(Object.keys(VIEWPORT_LABELS) as Viewport[]).map((item) => (
                        <option key={item} value={item} className="bg-white text-slate-800">
                          {VIEWPORT_LABELS[item]}
                        </option>
                      ))}
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none text-slate-400" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </label>
                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={disabled || isDiscovering}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isDiscovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {isDiscovering ? "Finding pages…" : "Find pages on this website"}
                  </button>
                </form>

                {/* Feature checkboxes */}
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-300">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={responsiveLayouts}
                      disabled={disabled}
                      onChange={(event) => setResponsiveLayouts(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800/80 text-blue-600 focus:ring-blue-500"
                    />
                    Capture responsive layouts
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={fullPageScreenshot}
                      disabled={disabled}
                      onChange={(event) => setFullPageScreenshot(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800/80 text-blue-600 focus:ring-blue-500"
                    />
                    Full Page Screenshot
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={captureAssets}
                      disabled={disabled}
                      onChange={(event) => setCaptureAssets(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800/80 text-blue-600 focus:ring-blue-500"
                    />
                    Capture Assets
                  </label>
                </div>

                {/* Errors / warnings */}
                {discoveryError && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-red-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{discoveryError}</p>}
                {error && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-red-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
                {responsiveLimitReached && <p role="alert" className="mt-3 text-sm text-amber-300">Responsive imports support up to 3 selected pages. Deselect {selectedPages.length - 3} page(s) to continue.</p>}

                {/* Discovered pages status chip when drawer is closed */}
                {discoveredPages.length > 0 && !isDrawerOpen && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/30 bg-slate-800/90 p-3.5 shadow-md">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-900/60 text-blue-400">
                        <Globe2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {discoveredPages.length} pages found ({selectedPages.length} selected)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Ready to review and convert to Figma
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPagesDrawer(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      <Search className="h-3.5 w-3.5" />
                      View pages & Import
                    </button>
                  </div>
                )}
              </div>

              {/* Right column — browser → Figma illustration */}
              <div aria-hidden="true" className="pointer-events-none relative hidden h-48 w-[340px] shrink-0 xl:flex">
                {/* Browser mockup */}
                <div className="absolute left-0 top-1/2 h-36 w-48 -translate-y-1/2 overflow-hidden rounded-xl border border-blue-400/20 bg-[#162548]/80 shadow-2xl backdrop-blur-sm">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-1.5 border-b border-blue-900/40 bg-[#0e1a38]/80 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-red-400/80" />
                    <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                    <div className="ml-2 h-2.5 flex-1 rounded bg-blue-900/40" />
                  </div>
                  {/* Page skeleton */}
                  <div className="p-3 space-y-2">
                    <div className="h-10 w-full rounded-md bg-blue-600/30" />
                    <div className="flex gap-2">
                      <div className="h-16 flex-1 rounded bg-blue-900/30" />
                      <div className="flex flex-col gap-1.5 flex-1">
                        <div className="h-2.5 w-full rounded bg-blue-900/30" />
                        <div className="h-2.5 w-4/5 rounded bg-blue-900/30" />
                        <div className="h-2.5 w-3/5 rounded bg-blue-900/30" />
                        <div className="mt-1 h-5 w-16 rounded bg-blue-500/30" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg border border-blue-400/30">
                  <ArrowRight className="h-4 w-4" />
                </div>

                {/* Figma panel mockup */}
                <div className="absolute right-0 top-1/2 h-36 w-36 -translate-y-1/2 overflow-hidden rounded-xl border border-blue-400/20 bg-[#162548]/80 shadow-2xl backdrop-blur-sm">
                  <div className="border-b border-blue-900/40 bg-[#0e1a38]/80 px-3 py-2">
                    <div className="h-2.5 w-20 rounded bg-blue-900/40" />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex gap-1.5">
                      <div className="h-12 flex-1 rounded bg-blue-600/20" />
                      <div className="h-12 flex-1 rounded bg-indigo-600/20" />
                    </div>
                    <div className="h-2 w-3/4 rounded bg-blue-900/30" />
                    <div className="h-2 w-1/2 rounded bg-blue-900/30" />
                  </div>
                  {/* Figma logo badge */}
                  <div className="absolute -bottom-2 -right-2 grid h-10 w-10 place-items-center rounded-xl bg-white shadow-md border border-slate-100">
                    <FigmaMark />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── How it works ────────────────────────────────────── */}
          <section className="pb-7 pt-8 sm:pb-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">How it works</h2>
            <p className="mt-1 text-sm text-slate-500">From a website URL to an editable Figma design in a few simple steps.</p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 items-start">
              {[
                {
                  num: "1",
                  title: "Enter URL",
                  subtitle: "Configure & Initiate",
                  icon: Link2,
                  bg: "bg-blue-100",
                  iconColor: "text-blue-600",
                  body: "Paste the website link and choose your settings, including viewport size and asset capture preferences.",
                },
                {
                  num: "2",
                  title: "Capture Website",
                  subtitle: "Render & Extract",
                  icon: Monitor,
                  bg: "bg-violet-100",
                  iconColor: "text-violet-600",
                  body: "We open the site in a real Chromium browser, extracting DOM structure, computed styles, and assets.",
                },
                {
                  num: "3",
                  title: "Convert & Organize",
                  subtitle: "Layer Translation",
                  icon: WandSparkles,
                  bg: "bg-emerald-100",
                  iconColor: "text-emerald-600",
                  body: "We analyze the layout and organize it for Figma with clean frames, Auto Layout, and design hierarchy.",
                },
                {
                  num: "4",
                  title: "Open in Figma",
                  subtitle: "Import & Edit",
                  icon: null,
                  bg: "bg-pink-100",
                  iconColor: "text-pink-600",
                  body: "Launch the design in Figma using the Web to Figma plugin and save your authentic .fig document.",
                },
              ].map(({ num, title, subtitle, icon: Icon, bg, iconColor, body }) => {
                const isOpen = !!openSteps[num];
                return (
                  <div
                    key={num}
                    className={`rounded-2xl border transition-all duration-200 bg-white ${
                      isOpen
                        ? "border-blue-200 shadow-md ring-2 ring-blue-500/10"
                        : "border-slate-200/90 shadow-sm hover:border-slate-300 hover:shadow"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStep(num)}
                      className="flex w-full items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3.5 text-left select-none cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold shrink-0 transition-colors ${
                            isOpen ? "bg-blue-600 text-white shadow-sm" : "bg-slate-200/90 text-slate-600"
                          }`}
                        >
                          {num}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 tracking-tight truncate">
                          {title}
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-blue-600" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 p-4 pt-3 text-xs text-slate-600 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`grid h-7 w-7 place-items-center rounded-lg ${bg} shrink-0`}>
                            {Icon ? <Icon className={`h-3.5 w-3.5 ${iconColor}`} /> : <FigmaMark />}
                          </div>
                          <span className="font-semibold text-slate-900 text-xs">{subtitle}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                          {body}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section id="recent-captures" className="border-t border-slate-200 pt-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Recent captures</h2>
                <p className="mt-1 text-sm text-slate-500">Your latest website imports and conversion status.</p>
              </div>
              {recentCaptures.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("projects")}
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  View all ({recentCaptures.length}) <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Exactly 5 items fitting in the width, no horizontal scrollbar */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {/* Import card — always first */}
              <button
                type="button"
                onClick={() => document.getElementById("website-url")?.focus()}
                className="group flex min-h-[290px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200/90 bg-white p-5 text-center transition hover:border-blue-400 hover:bg-blue-50/20"
              >
                <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-blue-100/80 text-blue-600 transition group-hover:scale-105">
                  <Plus className="h-6 w-6 stroke-[2.5] text-blue-600" />
                </span>
                <span className="text-sm font-bold text-slate-900">Import Your First Website</span>
                <span className="mt-2 max-w-[190px] text-xs leading-5 text-slate-500">
                  Start by adding a website URL and create your first Figma design.
                </span>
              </button>

              {/* Up to 4 Recent Capture cards so total is 5 cards fitting the width */}
              {recentCaptures.slice(0, 4).map((capture) => renderCaptureCard(capture, false))}
            </div>
          </section>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-400"><Globe2 className="h-3.5 w-3.5" />Website structure and assets are captured on the server using Playwright.</p>
        </main>
        )}
        </div> {/* end inner flex-col */}
      </div> {/* end sidebar+content row */}

      {/* ── Right Sidebar Drawer (Pages Found & Capturing Progress) ── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close panel"
            onClick={handleCloseDrawer}
            className="absolute inset-0 cursor-default bg-slate-950/30 transition-opacity"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-drawer-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform"
          >
            {isCapturing ? (
              /* State 2: Capturing Website Progress (Image 2) */
              <>
                <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                      <Globe2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 id="sidebar-drawer-title" className="text-base font-semibold text-slate-900">
                        Capturing Website
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Your capture is running in the background
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    aria-label="Hide progress panel"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-blue-600 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {captureStatus?.progress || `Queued ${selectedPages.length || 1} page layout(s)`}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-600">
                          {captureStatus?.originalUrl || url}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-6">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                        <Check className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Opening selected pages</p>
                        <p className="mt-1 text-xs text-slate-500">
                          The browser is loading the website at your chosen viewport.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Capturing structure and assets</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Text, layout, colors, images, and fonts are being collected.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 opacity-50">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                        <span className="h-2 w-2 rounded-full bg-current" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Preparing editable design</p>
                        <p className="mt-1 text-xs text-slate-500">
                          When capture completes, the results will open automatically.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-2">
                    <div className="skeleton h-2 w-full rounded-full" />
                    <div className="skeleton h-2 w-2/3 rounded-full" />
                  </div>
                </div>

                <footer className="border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
                  You can hide this panel. The capture will continue and open the results when it finishes.
                </footer>
              </>
            ) : (
              /* State 1: Pages Found List (Image 1) */
              <>
                <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                  <div>
                    <h2 id="sidebar-drawer-title" className="text-base font-semibold text-slate-900">
                      Pages found ({selectedPages.length} selected of {discoveredPages.length})
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Select pages to capture and convert to Figma
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPages(
                          selectedPages.length === discoveredPages.length ? [] : discoveredPages
                        )
                      }
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                    >
                      {selectedPages.length === discoveredPages.length ? "Deselect all" : "Select all"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseDrawer}
                      aria-label="Close panel"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                  {responsiveLimitReached && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Responsive imports support up to 3 selected pages. Deselect {selectedPages.length - 3} page(s) to continue.
                    </div>
                  )}

                  {discoveredPages.map((page) => {
                    const isChecked = selectedPages.includes(page);
                    return (
                      <label
                        key={page}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                          isChecked
                            ? "border-blue-200 bg-blue-50/40 text-slate-900 shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={disabled}
                          onChange={(event) =>
                            setSelectedPages((current) =>
                              event.target.checked
                                ? [...current, page]
                                : current.filter((item) => item !== page)
                            )
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 flex-1 break-all text-xs font-medium leading-5">
                          {page}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <footer className="border-t border-slate-200 p-6 bg-white">
                  <button
                    type="button"
                    onClick={submitImport}
                    disabled={disabled || !selectedPages.length || responsiveLimitReached}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Search className="h-4 w-4" />
                    Import {selectedPages.length} selected page{selectedPages.length === 1 ? "" : "s"}
                  </button>
                </footer>
              </>
            )}
          </aside>
        </div>
      )}

      {/* Delete confirmation modal — rendered at root so it overlays everything */}
      {pendingDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setPendingDelete(null); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-description" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4"><div><h2 id="delete-project-title" className="text-lg font-semibold text-slate-900">Delete capture project?</h2><p id="delete-project-description" className="mt-2 break-all text-sm text-slate-600">{pendingDelete.originalUrl}</p><p className="mt-2 text-sm text-slate-500">Its saved screens and assets will be removed.</p></div><button type="button" aria-label="Close confirmation" onClick={() => setPendingDelete(null)} disabled={deleting} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
          {deleteError && <p role="alert" className="mt-4 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setPendingDelete(null)} disabled={deleting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" onClick={confirmDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{deleting && <Loader2 className="h-4 w-4 animate-spin" />}{deleting ? "Deleting…" : "Delete project"}</button></div>
        </section>
      </div>}
    </div>
  );
}

function FigmaMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 32" className="h-7 w-6">
    <path d="M7 1h5v9H7a4.5 4.5 0 0 1 0-9Z" fill="#F24E1E" />
    <path d="M12 1h5a4.5 4.5 0 0 1 0 9h-5V1Z" fill="#FF7262" />
    <path d="M7 10h5v9H7a4.5 4.5 0 0 1 0-9Z" fill="#A259FF" />
    <circle cx="16.5" cy="14.5" r="4.5" fill="#1ABCFE" />
    <path d="M7 19h5v4.5A4.5 4.5 0 1 1 7 19Z" fill="#0ACF83" />
  </svg>;
}

function formatRelativeDate(value: string | null | undefined): string {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getCardTitle(capture: CaptureStatus): string {
  if (capture.pageTitle) return capture.pageTitle;
  try {
    const parsed = new URL(capture.originalUrl);
    const domain = parsed.hostname.replace(/^www\./, "").split(".")[0];
    const capitalized = domain.charAt(0).toUpperCase() + domain.slice(1);
    const path = parsed.pathname.replace(/\/$/, "");
    if (!path || path === "") return `${capitalized} - Homepage`;
    const cleanPath = path.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") || "Page";
    const capPath = cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1);
    return `${capitalized} - ${capPath}`;
  } catch {
    return capture.originalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Website capture";
  }
}

function getCardMeta(capture: CaptureStatus): string {
  const pages = capture.pageCount || 1;
  const pageStr = `${pages} page${pages === 1 ? "" : "s"}`;
  const sizeEstimate = `${(pages * 0.2 + 1.2).toFixed(1)} MB`;
  return `${pageStr} • ${sizeEstimate}`;
}
