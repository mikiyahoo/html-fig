import { validateUrl } from "./url-validator";

/** Normalize discovered links to unique, same-origin HTTP(S) page URLs. */
export function normalizeInternalPageLinks(baseUrl: string, links: string[], limit = 10): string[] {
  const baseValidation = validateUrl(baseUrl);
  if (!baseValidation.valid || !baseValidation.parsedUrl) return [];
  const base = baseValidation.parsedUrl;
  const pages: string[] = [base.href];
  const seen = new Set(pages);

  for (const href of links) {
    if (pages.length >= Math.max(1, limit)) break;
    if (/\s/.test(href)) continue;
    try {
      const target = new URL(href, base);
      target.hash = "";
      if (target.origin !== base.origin || !["http:", "https:"].includes(target.protocol)) continue;
      const validation = validateUrl(target.href);
      if (!validation.valid || !validation.parsedUrl) continue;
      const normalized = validation.parsedUrl.href;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      pages.push(normalized);
    } catch {
      // Ignore malformed link values from the page.
    }
  }

  return pages;
}
