import { z } from "zod";

export const FLOW_SCHEMA_VERSION = "1.0.0" as const;
export const MAX_FLOW_STEPS = 25;

export const flowKeySchema = z.enum(["Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "Space"]);

/** One user action that leads from a recorded state to the next one. */
export const flowActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }),
  z.object({
    type: z.literal("click"),
    selector: z.string().max(1_000).optional(),
    text: z.string().max(200).optional(),
    point: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
    label: z.string().max(200),
  }),
  z.object({ type: z.literal("fill"), selector: z.string().min(1).max(1_000), value: z.string().max(500), label: z.string().max(200) }),
  z.object({ type: z.literal("press"), key: flowKeySchema, label: z.string().max(200) }),
  z.object({ type: z.literal("wait"), ms: z.number().int().min(100).max(10_000), label: z.string().max(200) }),
  z.object({ type: z.literal("navigate"), url: z.string().url().max(2_000), label: z.string().max(200) }),
]).refine((action) => action.type !== "click" || !!(action.selector || action.text || action.point), "A click needs a target.");

export type FlowAction = z.infer<typeof flowActionSchema>;
export type FlowRisk = "low" | "high";

export interface FlowStep {
  id: string;
  name: string;
  /** Step this state was reached from; null for the start page. Steps form a graph, so branches are allowed. */
  parentId: string | null;
  action: FlowAction;
  risk: FlowRisk;
  captureId: string;
  url: string;
  title: string;
  fingerprint: string;
  warnings: string[];
  note?: string;
  createdAt: string;
}

export interface FlowRecord {
  schemaVersion: typeof FLOW_SCHEMA_VERSION;
  id: string;
  name: string;
  startUrl: string;
  viewport: "desktop" | "tablet" | "mobile";
  /** Display order chosen by the user; the graph is defined by each step's parentId. */
  steps: FlowStep[];
  createdAt: string;
  updatedAt: string;
}

/** A clickable or fillable element on a captured step, for the recorder's target picker. */
export interface FlowTarget {
  selector: string;
  tag: string;
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  fillable: boolean;
}

/** Human-readable description of an action, used in the step rail and in Figma frame labels. */
export function describeAction(action: FlowAction): string {
  switch (action.type) {
    case "start": return "Opened start page";
    case "click": return `Clicked “${action.label || action.text || "element"}”`;
    case "fill": return `Typed into “${action.label || "field"}”`;
    case "press": return `Pressed ${action.key}`;
    case "wait": return `Waited ${action.ms} ms`;
    case "navigate": return `Went to ${action.url}`;
    default: return "Unknown action";
  }
}

/** The ordered actions that reproduce a step from the start page. */
export function actionPathTo(flow: FlowRecord, stepId: string): FlowStep[] {
  const byId = new Map(flow.steps.map((step) => [step.id, step]));
  const path: FlowStep[] = [];
  let current = byId.get(stepId);
  while (current) {
    if (path.includes(current)) throw new Error("This flow's step graph contains a loop.");
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
