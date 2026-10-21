import type { FlowAction, FlowRisk } from "./flow-types";

// Words that suggest an action may move money, create or destroy records, or end the session.
const HIGH_RISK_LABEL = /\b(pay|payment|transfer|send|purchase|buy|checkout|check out|place order|order now|confirm|delete|remove|submit|sign out|log ?out|unsubscribe|cancel (my )?(subscription|account)|close account|withdraw|donate)\b/i;

/** Classify a recorded action. High-risk actions need explicit confirmation and end their branch. */
export function classifyActionRisk(action: FlowAction): FlowRisk {
  if (action.type === "click") return HIGH_RISK_LABEL.test(`${action.label} ${action.text || ""}`) ? "high" : "low";
  // Enter in a form field usually submits the form.
  if (action.type === "press") return action.key === "Enter" ? "high" : "low";
  return "low";
}

export function riskExplanation(action: FlowAction): string {
  if (action.type === "press") return "Pressing Enter can submit a form on the live site.";
  return "This control looks like it could submit, pay, send, or delete something on the live site.";
}

/** Attributes that mark an input as a secret or payment field the recorder must not type into. */
export function isSensitiveField(attributes: { type?: string | null; name?: string | null; autocomplete?: string | null; id?: string | null }): boolean {
  const type = (attributes.type || "").toLowerCase();
  if (type === "password" || type === "hidden") return true;
  const autocomplete = (attributes.autocomplete || "").toLowerCase();
  if (/^(cc-|current-password|new-password|one-time-code)/.test(autocomplete.split(" ").pop() || "")) return true;
  const hint = `${attributes.name || ""} ${attributes.id || ""}`.toLowerCase();
  return /(password|passcode|\bpin\b|otp|cvv|cvc|card.?number|ssn|social.?security|iban|routing|account.?number)/.test(hint);
}
