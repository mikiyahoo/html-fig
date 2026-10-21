"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Download, ExternalLink, GitBranch, Keyboard, Loader2, MousePointerClick, Pencil, Plus, Timer, Trash2, Type, Workflow, X, Link2 } from "lucide-react";
import type { FlowAction, FlowRecord, FlowStep, FlowTarget } from "@/lib/flow-types";
import { actionPathTo, describeAction, MAX_FLOW_STEPS } from "@/lib/flow-types";
import type { FlowSummary } from "@/lib/flow-api";
import { validateUrl, VIEWPORT_LABELS, type Viewport } from "@/lib/url-validator";

type ActionMode = "click" | "fill" | "press" | "wait" | "navigate";
type StepTargets = { targets: FlowTarget[]; image: { url: string; width: number; height: number } };
type PendingRisk = { message: string; body: Record<string, unknown> };

const KEYS = ["Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "Space"] as const;
const MODES: Array<{ id: ActionMode; label: string; icon: typeof MousePointerClick }> = [
  { id: "click", label: "Click", icon: MousePointerClick },
  { id: "fill", label: "Type", icon: Type },
  { id: "press", label: "Key", icon: Keyboard },
  { id: "wait", label: "Wait", icon: Timer },
  { id: "navigate", label: "Go to URL", icon: Link2 },
];

export default function FlowRecorder() {
  const [flows, setFlows] = useState<FlowSummary[] | null>(null);
  const [flow, setFlow] = useState<FlowRecord | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFlows = useCallback(async () => {
    try {
      const response = await fetch("/api/flows", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load flows.");
      setFlows(payload.flows);
    } catch (err) {
      setError((err as Error).message);
      setFlows([]);
    }
  }, []);

  useEffect(() => { void loadFlows(); }, [loadFlows]);

  const openFlow = async (id: string) => {
    setError(null);
    setBusy("Loading flow…");
    try {
      const response = await fetch(`/api/flows/${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load this flow.");
      setFlow(payload.flow);
      setSelectedStepId(payload.flow.steps[payload.flow.steps.length - 1]?.id || null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const createFlow = async (name: string, startUrl: string, viewport: Viewport) => {
    setError(null);
    setBusy("Opening the start page and capturing step 1…");
    try {
      const response = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startUrl, viewport }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start recording.");
      setFlow(payload.flow);
      setSelectedStepId(payload.flow.steps[0]?.id || null);
      void loadFlows();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const deleteFlow = async (id: string) => {
    const response = await fetch(`/api/flows/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Could not delete this flow.");
      return;
    }
    setFlows((current) => current?.filter((item) => item.id !== id) || null);
  };

  if (flow) {
    return (
      <RecorderView
        flow={flow}
        selectedStepId={selectedStepId}
        onSelectStep={setSelectedStepId}
        onFlowChange={setFlow}
        onClose={() => { setFlow(null); void loadFlows(); }}
      />
    );
  }

  return (
    <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">User Flows</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Record a journey step by step — modals, tabs, and form states count as separate steps even when the URL doesn&apos;t change. Each step becomes its own Figma frame.
        </p>
      </div>

      <NewFlowForm disabled={!!busy} onCreate={createFlow} />

      {busy && <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin text-blue-600" />{busy}</p>}
      {error && <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Recorded flows</h2>
      {flows === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-56 rounded-xl" />)}</div>
      ) : flows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <Workflow className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">No flows yet</p>
          <p className="mt-1 text-xs text-slate-500">Start one above, for example “Dashboard → Send Money → Review”.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {flows.map((item) => (
            <article key={item.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <button type="button" onClick={() => openFlow(item.id)} disabled={!!busy} className="block w-full text-left">
                <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                  {item.coverCaptureId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/captures/${item.coverCaptureId}/screenshot`} alt="" className="h-full w-full object-cover object-top" />
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{item.startUrl}</p>
                  <p className="mt-2 text-xs text-slate-600">{item.stepCount} step{item.stepCount === 1 ? "" : "s"} · {VIEWPORT_LABELS[item.viewport]}</p>
                </div>
              </button>
              <div className="flex justify-end border-t border-slate-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => { if (window.confirm(`Delete “${item.name}” and all of its captured steps?`)) void deleteFlow(item.id); }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function NewFlowForm({ disabled, onCreate }: { disabled: boolean; onCreate: (name: string, url: string, viewport: Viewport) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const validation = validateUrl(url);
        if (!validation.valid || !validation.parsedUrl) { setValidationError(validation.error || "Enter a valid URL."); return; }
        if (!name.trim()) { setValidationError("Give the flow a name."); return; }
        setValidationError(null);
        onCreate(name.trim(), validation.parsedUrl.href, viewport);
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end">
        <label className="text-xs font-medium text-slate-600">Flow name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Send money" maxLength={120} disabled={disabled}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring" />
        </label>
        <label className="text-xs font-medium text-slate-600">Start URL
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/dashboard" disabled={disabled} autoComplete="off"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring" />
        </label>
        <label className="text-xs font-medium text-slate-600">Viewport
          <select value={viewport} onChange={(event) => setViewport(event.target.value as Viewport)} disabled={disabled}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring">
            {(Object.keys(VIEWPORT_LABELS) as Viewport[]).map((option) => <option key={option} value={option}>{VIEWPORT_LABELS[option]}</option>)}
          </select>
        </label>
        <button type="submit" disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
          <Plus className="h-4 w-4" /> Start recording
        </button>
      </div>
      {validationError && <p className="mt-2 text-sm text-red-600">{validationError}</p>}
      <p className="mt-3 text-xs text-slate-500">Only record sites you&apos;re allowed to capture. Use test accounts and test data; the recorder won&apos;t type into password or payment fields.</p>
    </form>
  );
}

function RecorderView({ flow, selectedStepId, onSelectStep, onFlowChange, onClose }: {
  flow: FlowRecord;
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  onFlowChange: (flow: FlowRecord) => void;
  onClose: () => void;
}) {
  const selected = flow.steps.find((step) => step.id === selectedStepId) || flow.steps[flow.steps.length - 1];
  const [targets, setTargets] = useState<StepTargets | null>(null);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [picked, setPicked] = useState<FlowTarget | null>(null);
  const [mode, setMode] = useState<ActionMode>("click");
  const [clickText, setClickText] = useState("");
  const [fillValue, setFillValue] = useState("");
  const [key, setKey] = useState<(typeof KEYS)[number]>("Escape");
  const [waitMs, setWaitMs] = useState(1000);
  const [navigateUrl, setNavigateUrl] = useState("");
  const [stepName, setStepName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRisk, setPendingRisk] = useState<PendingRisk | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [flowName, setFlowName] = useState(flow.name);
  const [figmaLink, setFigmaLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setTargets(null);
    setTargetsError(null);
    setPicked(null);
    fetch(`/api/flows/${flow.id}/steps/${selected.id}/targets`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load this step.");
        if (!cancelled) setTargets(payload);
      })
      .catch((err) => { if (!cancelled) setTargetsError((err as Error).message); });
    return () => { cancelled = true; };
  }, [flow.id, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pathToSelected = useMemo(() => selected ? actionPathTo(flow, selected.id) : [], [flow, selected]);
  const branchClosed = pathToSelected.some((step) => step.risk === "high");
  const atLimit = flow.steps.length >= MAX_FLOW_STEPS;

  const patchFlow = async (body: Record<string, unknown>) => {
    setError(null);
    const response = await fetch(`/api/flows/${flow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "Could not update the flow."); return; }
    onFlowChange(payload.flow);
    if (!payload.flow.steps.some((step: FlowStep) => step.id === selectedStepId)) {
      onSelectStep(payload.flow.steps[payload.flow.steps.length - 1]?.id);
    }
  };

  const stepList = (steps: FlowStep[]) => steps.map((step) => ({ id: step.id, name: step.name, note: step.note }));
  const moveStep = (index: number, delta: number) => {
    const steps = [...flow.steps];
    const [moved] = steps.splice(index, 1);
    steps.splice(index + delta, 0, moved);
    void patchFlow({ steps: stepList(steps) });
  };
  const renameStep = (id: string, name: string) => {
    void patchFlow({ steps: stepList(flow.steps.map((step) => step.id === id ? { ...step, name } : step)) });
  };
  const deleteStep = (id: string) => {
    void patchFlow({ steps: stepList(flow.steps.filter((step) => step.id !== id)) });
  };

  const buildAction = (): FlowAction | string => {
    switch (mode) {
      case "click":
        if (picked) {
          return { type: "click", selector: picked.selector, label: picked.label || picked.tag,
            point: { x: picked.rect.x + picked.rect.width / 2, y: picked.rect.y + picked.rect.height / 2 } };
        }
        return clickText.trim() ? { type: "click", text: clickText.trim(), label: clickText.trim() } : "Pick an element on the screenshot, or enter its visible text.";
      case "fill":
        if (!picked || !picked.fillable) return "Pick a text field on the screenshot.";
        return { type: "fill", selector: picked.selector, value: fillValue, label: picked.label || "field" };
      case "press":
        return { type: "press", key, label: key };
      case "wait":
        return { type: "wait", ms: waitMs, label: `${waitMs} ms` };
      case "navigate": {
        const validation = validateUrl(navigateUrl);
        return validation.valid && validation.parsedUrl
          ? { type: "navigate", url: validation.parsedUrl.href, label: validation.parsedUrl.href }
          : validation.error || "Enter a valid URL.";
      }
    }
  };

  const recordStep = async (body: Record<string, unknown>) => {
    setError(null);
    setPendingRisk(null);
    const replayCount = pathToSelected.length - 1;
    setBusy(replayCount > 0 ? `Replaying ${replayCount} action${replayCount === 1 ? "" : "s"}, then capturing the new step…` : "Performing the action and capturing the new step…");
    try {
      const response = await fetch(`/api/flows/${flow.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (response.status === 409 && payload.code === "RISK_CONFIRMATION_REQUIRED") {
        setPendingRisk({ message: payload.error, body });
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Could not record this step.");
      onFlowChange(payload.flow);
      onSelectStep(payload.step.id);
      setStepName("");
      setClickText("");
      setFillValue("");
      setFigmaLink(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submitAction = () => {
    if (!selected) return;
    const action = buildAction();
    if (typeof action === "string") { setError(action); return; }
    void recordStep({ parentStepId: selected.id, action, name: stepName.trim() || undefined });
  };

  const createFigmaLink = async () => {
    setError(null);
    const response = await fetch("/api/figma/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flowId: flow.id }),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "Could not create a Figma link."); return; }
    setFigmaLink(payload.importUrl);
    setCopied(false);
  };

  const stepNumber = (id: string | null) => id ? flow.steps.findIndex((step) => step.id === id) + 1 : 0;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onClose} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 disabled:opacity-50">
            <ArrowLeft className="h-3.5 w-3.5" /> Flows
          </button>
          {editingName ? (
            <form onSubmit={(event) => { event.preventDefault(); setEditingName(false); if (flowName.trim() && flowName.trim() !== flow.name) void patchFlow({ name: flowName.trim() }); }} className="flex items-center gap-1">
              <input autoFocus value={flowName} onChange={(event) => setFlowName(event.target.value)} maxLength={120} onBlur={() => { setEditingName(false); setFlowName(flow.name); }}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm font-semibold focus-ring" />
            </form>
          ) : (
            <button type="button" onClick={() => setEditingName(true)} className="group flex min-w-0 items-center gap-1.5 text-left">
              <h1 className="truncate text-base font-semibold text-slate-900">{flow.name}</h1>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
            </button>
          )}
          <span className="hidden truncate text-xs text-slate-500 md:inline">{flow.startUrl} · {VIEWPORT_LABELS[flow.viewport]}</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/flows/${flow.id}/export`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <Download className="h-4 w-4" /> Download ZIP
          </a>
          <button type="button" onClick={createFigmaLink} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
            <ExternalLink className="h-4 w-4" /> Open in Figma
          </button>
        </div>
      </header>

      {figmaLink && (
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-slate-700 sm:px-6">
          <span>In Figma, run the Web to Figma plugin and paste this link (expires in 30 minutes):</span>
          <code className="min-w-0 max-w-full truncate rounded bg-white px-2 py-1 text-slate-900">{figmaLink}</code>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(figmaLink).then(() => setCopied(true)); }}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 font-medium text-blue-700 hover:bg-blue-100">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={() => setFigmaLink(null)} aria-label="Dismiss" className="ml-auto rounded p-1 text-slate-500 hover:bg-blue-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        {/* Step rail */}
        <aside aria-label="Steps" className="border-b border-slate-200 bg-slate-50/60 lg:border-b-0 lg:border-r">
          <ol className="flex gap-2 overflow-x-auto p-3 lg:max-h-[calc(100vh-7.5rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
            {flow.steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                count={flow.steps.length}
                selected={step.id === selected?.id}
                branchFrom={step.parentId && step.parentId !== flow.steps[index - 1]?.id ? stepNumber(step.parentId) : null}
                disabled={!!busy}
                onSelect={() => onSelectStep(step.id)}
                onRename={(name) => renameStep(step.id, name)}
                onMove={(delta) => moveStep(index, delta)}
                onDelete={() => deleteStep(step.id)}
              />
            ))}
          </ol>
        </aside>

        {/* Screenshot with target picker */}
        <section className="min-w-0 bg-slate-100/70 p-3 sm:p-5">
          {selected && (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">Step {stepNumber(selected.id)} · {selected.name}</span>
              <span className="truncate">{selected.url}</span>
              <span className="text-slate-400">{describeAction(selected.action)}</span>
            </div>
          )}
          {selected?.warnings.length ? (
            <ul className="mb-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {selected.warnings.slice(0, 4).map((warning) => <li key={warning} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}</li>)}
            </ul>
          ) : null}
          {targetsError ? (
            <p className="text-sm text-red-600">{targetsError}</p>
          ) : !targets ? (
            <div className="skeleton aspect-[16/10] w-full rounded-lg" />
          ) : (
            <TargetPicker targets={targets} picked={picked} disabled={!!busy || branchClosed}
              onPick={(target) => { setPicked(target); setMode(target.fillable ? "fill" : "click"); setError(null); }} />
          )}
        </section>

        {/* Next action */}
        <aside className="border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
          <h2 className="text-sm font-semibold text-slate-900">Record next step</h2>
          <p className="mt-1 text-xs text-slate-500">
            Continues from <span className="font-medium text-slate-700">Step {selected ? stepNumber(selected.id) : 0}</span>. Pick another step in the rail to record a branch.
          </p>

          {branchClosed ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              This branch ended with a high-risk action. Replaying it would repeat that action on the live site, so steps can&apos;t be added after it. Select an earlier step to record another branch.
            </p>
          ) : atLimit ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">This flow has reached the {MAX_FLOW_STEPS}-step limit.</p>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); submitAction(); }} className="mt-4 space-y-4">
              <div role="tablist" aria-label="Action type" className="grid grid-cols-5 gap-1 rounded-lg bg-slate-100 p-1">
                {MODES.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} disabled={!!busy} title={label}
                    className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition ${mode === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>

              {(mode === "click" || mode === "fill") && (
                <div className="rounded-lg border border-slate-200 p-3 text-xs">
                  {picked ? (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{picked.label || picked.tag}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500" title={picked.selector}>{picked.selector}</p>
                      </div>
                      <button type="button" onClick={() => setPicked(null)} aria-label="Clear picked element" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <p className="text-slate-500">{mode === "fill" ? "Click a text field on the screenshot." : "Click an element on the screenshot."}</p>
                  )}
                </div>
              )}

              {mode === "click" && !picked && (
                <label className="block text-xs font-medium text-slate-600">Or click by visible text
                  <input value={clickText} onChange={(event) => setClickText(event.target.value)} placeholder="Send money" maxLength={200} disabled={!!busy}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring" />
                </label>
              )}
              {mode === "fill" && (
                <label className="block text-xs font-medium text-slate-600">Text to type (test data only)
                  <input value={fillValue} onChange={(event) => setFillValue(event.target.value)} maxLength={500} disabled={!!busy} autoComplete="off"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring" />
                </label>
              )}
              {mode === "press" && (
                <label className="block text-xs font-medium text-slate-600">Key
                  <select value={key} onChange={(event) => setKey(event.target.value as (typeof KEYS)[number])} disabled={!!busy}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring">
                    {KEYS.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              )}
              {mode === "wait" && (
                <label className="block text-xs font-medium text-slate-600">Wait (ms) — use for animations or delayed content
                  <input type="number" min={100} max={10000} step={100} value={waitMs} onChange={(event) => setWaitMs(Math.min(10000, Math.max(100, Number(event.target.value) || 100)))} disabled={!!busy}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring" />
                </label>
              )}
              {mode === "navigate" && (
                <label className="block text-xs font-medium text-slate-600">URL
                  <input value={navigateUrl} onChange={(event) => setNavigateUrl(event.target.value)} placeholder="https://example.com/settings" disabled={!!busy} autoComplete="off"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring" />
                </label>
              )}

              <label className="block text-xs font-medium text-slate-600">Name the new step (optional)
                <input value={stepName} onChange={(event) => setStepName(event.target.value)} placeholder={`Step ${flow.steps.length + 1}`} maxLength={120} disabled={!!busy}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring" />
              </label>

              <button type="submit" disabled={!!busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {busy ? "Recording…" : "Perform & capture step"}
              </button>
              <button type="button" disabled={!!busy} onClick={() => selected && void recordStep({ parentStepId: selected.id, action: { type: "wait", ms: 500, label: "500 ms" }, name: stepName.trim() || undefined })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                Capture this state again as a new step
              </button>
            </form>
          )}

          {busy && <p className="mt-3 text-xs text-slate-600" aria-live="polite">{busy}</p>}
          {error && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs text-red-600"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}
          <p className="mt-4 text-[11px] leading-4 text-slate-400">Each new step opens a fresh browser, replays the steps that lead to it, then performs your action. Typed values are kept for replay and redacted from exports.</p>
        </aside>
      </div>

      {pendingRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="risk-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-5 w-5" /></span>
              <div>
                <h2 id="risk-title" className="text-base font-semibold text-slate-900">Perform this on the live site?</h2>
                <p className="mt-1 text-sm text-slate-600">{pendingRisk.message}</p>
                <p className="mt-2 text-sm text-slate-600">Only continue on a test or sandbox environment you&apos;re authorized to use. This branch will end after this step, so the action is never replayed.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingRisk(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void recordStep({ ...pendingRisk.body, confirmRisk: true })} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">Perform action</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function StepCard({ step, index, count, selected, branchFrom, disabled, onSelect, onRename, onMove, onDelete }: {
  step: FlowStep; index: number; count: number; selected: boolean; branchFrom: number | null; disabled: boolean;
  onSelect: () => void; onRename: (name: string) => void; onMove: (delta: number) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(step.name);
  useEffect(() => setName(step.name), [step.name]);

  return (
    <li className={`w-44 shrink-0 overflow-hidden rounded-lg border bg-white transition lg:w-auto ${selected ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}>
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-current={selected ? "step" : undefined}>
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/captures/${step.captureId}/screenshot`} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
          <span className="absolute left-1.5 top-1.5 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
          {step.risk === "high" && <span className="absolute right-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">High risk</span>}
          {step.risk !== "high" && step.warnings.length > 0 && <span title={step.warnings.join("\n")} className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3" /></span>}
        </div>
      </button>
      <div className="p-2">
        {editing ? (
          <form onSubmit={(event) => { event.preventDefault(); setEditing(false); if (name.trim() && name.trim() !== step.name) onRename(name.trim()); }}>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120}
              onBlur={() => { setEditing(false); setName(step.name); }}
              className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs focus-ring" />
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} disabled={disabled} title="Rename step" className="block w-full truncate text-left text-xs font-semibold text-slate-900 hover:text-blue-700">{step.name}</button>
        )}
        <p className="mt-0.5 truncate text-[11px] text-slate-500" title={describeAction(step.action)}>{describeAction(step.action)}</p>
        {branchFrom ? <p className="mt-0.5 flex items-center gap-1 text-[11px] text-violet-600"><GitBranch className="h-3 w-3" />from step {branchFrom}</p> : null}
        <div className="mt-1.5 flex items-center gap-0.5">
          <button type="button" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label="Move step up" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label="Move step down" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDelete} disabled={disabled || step.action.type === "start"} aria-label="Delete step" title={step.action.type === "start" ? "The start step can't be deleted" : "Delete step"}
            className="ml-auto rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </li>
  );
}

/** Full-page screenshot with hover highlighting; clicking picks the smallest interactive element under the pointer. */
function TargetPicker({ targets, picked, disabled, onPick }: { targets: StepTargets; picked: FlowTarget | null; disabled: boolean; onPick: (target: FlowTarget) => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<FlowTarget | null>(null);
  const { width, height } = targets.image;

  const targetAt = (event: React.MouseEvent) => {
    const box = wrapperRef.current?.getBoundingClientRect();
    if (!box) return null;
    const x = (event.clientX - box.left) / box.width * width;
    const y = (event.clientY - box.top) / box.height * height;
    let best: FlowTarget | null = null;
    for (const target of targets.targets) {
      const { rect } = target;
      if (x < rect.x || y < rect.y || x > rect.x + rect.width || y > rect.y + rect.height) continue;
      if (!best || rect.width * rect.height < best.rect.width * best.rect.height) best = target;
    }
    return best;
  };

  const boxStyle = (target: FlowTarget) => ({
    left: `${target.rect.x / width * 100}%`,
    top: `${target.rect.y / height * 100}%`,
    width: `${target.rect.width / width * 100}%`,
    height: `${target.rect.height / height * 100}%`,
  });

  return (
    <div className="max-h-[calc(100vh-12rem)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <div
        ref={wrapperRef}
        className={`relative ${disabled ? "cursor-default" : "cursor-crosshair"}`}
        onMouseMove={(event) => { if (!disabled) setHovered(targetAt(event)); }}
        onMouseLeave={() => setHovered(null)}
        onClick={(event) => { if (disabled) return; const target = targetAt(event); if (target) onPick(target); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={targets.image.url} alt="Captured step" className="block w-full select-none" draggable={false} />
        {hovered && hovered !== picked && (
          <div className="pointer-events-none absolute rounded-sm border-2 border-blue-400 bg-blue-400/10" style={boxStyle(hovered)}>
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">{hovered.label || hovered.tag}</span>
          </div>
        )}
        {picked && <div className="pointer-events-none absolute rounded-sm border-2 border-emerald-500 bg-emerald-500/15" style={boxStyle(picked)} />}
      </div>
      {targets.targets.length === 0 && <p className="border-t border-slate-100 p-3 text-xs text-slate-500">No clickable elements were detected on this step. Use “click by visible text”, a key, or a URL instead.</p>}
    </div>
  );
}
