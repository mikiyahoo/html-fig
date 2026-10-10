"use client";

import { useState } from "react";
import type { CaptureStatus } from "@/lib/types";
import type { Viewport } from "@/lib/url-validator";
import { VIEWPORT_LABELS } from "@/lib/url-validator";
import { Check, Clock3, ExternalLink, Folder, Globe2, Layers3, Loader2, Link2, Monitor, Smartphone, Tablet, Trash2, Upload, X } from "lucide-react";

interface DashboardProps {
  onStartCapture: (url: string, viewport: Viewport) => void;
  onViewCapture: (captureId: string, batchId?: string) => void;
  onDeleteCapture: (capture: CaptureStatus) => Promise<void>;
  recentCaptures: CaptureStatus[];
}

const viewportIcon = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export default function Dashboard({ onStartCapture, onViewCapture, onDeleteCapture, recentCaptures }: DashboardProps) {
  const [url, setUrl] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [pendingDelete, setPendingDelete] = useState<CaptureStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const ViewportIcon = viewportIcon[viewport];

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white shadow-sm"><Layers3 className="h-5 w-5" /></div>
          <span className="text-lg font-bold tracking-tight">Web to Figma</span>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Capture workspace</span>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <p className="px-3 pb-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
          <nav className="space-y-1">
            <a href="#dashboard" className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700"><Layers3 className="h-4 w-4" />Dashboard</a>
            <button type="button" onClick={() => document.getElementById("website-url")?.focus()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"><Link2 className="h-4 w-4" />Import website</button>
            <a href="#recent-captures" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"><Folder className="h-4 w-4" />My projects</a>
          </nav>
          <div className="absolute bottom-5 left-4 right-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700"><Globe2 className="h-4 w-4 text-blue-600" />From web to Figma</div>
            Capture a website, then import its editable layers into Figma.
          </div>
        </aside>

        <main id="dashboard" className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-8 lg:py-8">
          <section className="relative isolate overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/80 to-indigo-100/80 p-6 shadow-sm sm:p-9 xl:p-11">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 h-72 w-[42rem] rounded-full bg-blue-200/30 blur-3xl" />
            <div className="grid items-center gap-10 xl:grid-cols-[1.15fr_.85fr]">
              <div>
                <span className="inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700">Convert websites to Figma</span>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Web to Figma</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Turn a website into editable design layers. Capture the page, convert its structure, then open it in Figma.</p>

                <form className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-md sm:flex-row" onSubmit={(event) => { event.preventDefault(); onStartCapture(url, viewport); }}>
                  <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                    <Link2 className="h-5 w-5 shrink-0 text-slate-400" />
                    <input id="website-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" className="h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                  </label>
                  <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 sm:border-0 sm:border-l sm:rounded-none">
                    <ViewportIcon className="h-4 w-4 text-slate-500" />
                    <span className="sr-only">Viewport size</span>
                    <select aria-label="Viewport size" value={viewport} onChange={(event) => setViewport(event.target.value as Viewport)} className="max-w-40 bg-transparent outline-none">
                      {(Object.keys(VIEWPORT_LABELS) as Viewport[]).map((item) => <option key={item} value={item}>{VIEWPORT_LABELS[item]}</option>)}
                    </select>
                  </label>
                  <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-ring"><Upload className="h-4 w-4" />Import website</button>
                </form>

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-600">
                  {["Capture images & assets", "Detect fonts & colors", "Editable Figma layers"].map((feature) => <span key={feature} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" />{feature}</span>)}
                </div>
              </div>

              <div aria-hidden="true" className="relative mx-auto hidden h-56 w-full max-w-lg items-center justify-center xl:flex">
                <div className="absolute left-2 top-8 h-40 w-56 -rotate-3 rounded-xl border border-blue-100 bg-white p-3 shadow-lg">
                  <div className="mb-3 flex gap-1"><i className="h-2 w-2 rounded-full bg-red-300" /><i className="h-2 w-2 rounded-full bg-amber-300" /><i className="h-2 w-2 rounded-full bg-emerald-300" /></div>
                  <div className="h-14 rounded-lg bg-gradient-to-r from-sky-100 to-indigo-100" />
                  <div className="mt-3 h-2 w-2/3 rounded bg-slate-100" /><div className="mt-2 h-2 w-1/2 rounded bg-slate-100" />
                  <div className="mt-4 flex gap-2"><div className="h-6 w-16 rounded bg-blue-100" /><div className="h-6 w-16 rounded bg-slate-100" /></div>
                </div>
                <ArrowRight className="absolute left-[48%] top-1/2 h-8 w-8 -translate-y-1/2 text-blue-600" />
                <div className="absolute right-2 top-9 h-40 w-40 rotate-3 rounded-xl border border-blue-100 bg-white p-4 shadow-lg">
                  <div className="mb-3 h-5 w-20 rounded bg-indigo-50" />
                  <div className="flex gap-2"><div className="h-20 flex-1 rounded-md bg-blue-50" /><div className="h-20 flex-1 rounded-md bg-violet-50" /></div>
                  <div className="mt-3 flex gap-2"><div className="h-7 flex-1 rounded bg-slate-100" /><div className="h-7 flex-1 rounded bg-slate-100" /></div>
                  <div className="absolute -bottom-3 -right-3 grid h-12 w-12 place-items-center rounded-xl bg-white shadow-md"><span className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 via-blue-500 to-emerald-400" /></div>
                </div>
                <div className="absolute inset-x-10 bottom-2 -z-10 h-20 rounded-full bg-blue-300/30 blur-2xl" />
              </div>
            </div>
          </section>

          <section className="py-7 sm:py-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">How it works</h2>
            <p className="mt-1 text-sm text-slate-500">From a website URL to an editable Figma design in a few simple steps.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Link2, title: "1. Enter URL", body: "Paste a website link and choose the screen size." },
                { icon: Monitor, title: "2. Capture website", body: "Playwright opens the page and records its visible structure and assets." },
                { icon: Layers3, title: "3. Convert & organize", body: "The page becomes a structured set of editable design layers." },
                { icon: ExternalLink, title: "4. Open in Figma", body: "Import the design in Figma, then save a local copy there." },
              ].map(({ icon: Icon, title, body }) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></article>)}
            </div>
          </section>

          <section id="recent-captures" className="border-t border-slate-200 pt-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><h2 className="text-xl font-bold tracking-tight text-slate-900">Recent captures</h2><p className="mt-1 text-sm text-slate-500">Your latest website imports and capture status.</p></div>
              <span className="text-sm text-slate-500">{recentCaptures.length} {recentCaptures.length === 1 ? "project" : "projects"}</span>
            </div>
            {recentCaptures.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <button type="button" onClick={() => document.getElementById("website-url")?.focus()} className="group flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center transition hover:border-blue-400 hover:bg-blue-50/30">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-blue-100 text-blue-700"><Upload className="h-5 w-5" /></span><span className="text-sm font-semibold text-slate-900">Import another website</span><span className="mt-1 max-w-52 text-xs leading-5 text-slate-500">Add a URL above to create another editable design.</span>
                </button>
                {recentCaptures.map((capture) => <article key={capture.batchId || capture.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <button type="button" onClick={() => onViewCapture(capture.id, capture.batchId)} className="block w-full text-left focus-ring">
                    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-slate-100 to-blue-50">
                      {capture.screenshotUrl ? <img src={capture.screenshotUrl} alt={`Preview of ${capture.originalUrl}`} loading="lazy" className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center text-slate-300"><Globe2 className="h-10 w-10" /></div>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><Globe2 className="h-3 w-3 shrink-0" /><span className="truncate">{capture.originalUrl}</span></div>
                      <h3 className="mt-2 truncate text-sm font-semibold text-slate-900" title={capture.originalUrl}>{capture.originalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Website capture"}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Folder className="h-3.5 w-3.5" />{capture.progress || "Website capture"}</div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${capture.state === "completed" ? "bg-emerald-50 text-emerald-700" : capture.state === "failed" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{capture.state === "completed" ? "Ready" : capture.state === "failed" ? "Failed" : "Processing"}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="h-3 w-3" />{formatRelativeDate(capture.completedAt || capture.startedAt)}</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex justify-end border-t border-slate-100 px-3 py-2"><button type="button" onClick={() => setPendingDelete(capture)} aria-label={`Delete ${capture.originalUrl}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" />Delete</button></div>
                </article>)}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-600"><Upload className="h-5 w-5" /></div><h3 className="mt-4 text-sm font-semibold text-slate-900">No captures yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Enter a website URL above and your first capture will appear here.</p></div>
            )}
          </section>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-400"><Globe2 className="h-3.5 w-3.5" />Website structure and assets are captured on the server using Playwright.</p>
        </main>
      </div>

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
