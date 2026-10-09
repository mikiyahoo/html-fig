import { z } from "zod";

export const captureSchema = z.object({
  url: z
    .string()
    .regex(/^https?:\/\/.+/, "URL must start with http:// or https://")
    .refine((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }, "Invalid URL format"),
  viewport: z.enum(["desktop", "tablet", "mobile"]),
  fullPageScreenshot: z.boolean().optional().default(false),
  captureAssets: z.boolean().optional().default(true),
  captureSchemaVersion: z.number().optional().default(1),
});

export type CaptureInput = z.infer<typeof captureSchema>;

export const viewportConfigs = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

export const viewportLabels = {
  desktop: "Desktop (1440x900)",
  tablet: "Tablet (768x1024)",
  mobile: "Mobile (390x844)",
} as const;