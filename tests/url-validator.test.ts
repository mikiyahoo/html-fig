import { describe, it, expect } from "vitest";
import { validateUrl, isPrivateIpAddress, isPrivateNetworkDestination } from "@/lib/url-validator";
import { captureSchema } from "@/schemas/capture.schema";

describe("URL Validation", () => {
  it("blocks reserved documentation ranges without blocking their public neighbours", () => {
    for (const address of ["192.0.0.8", "192.0.2.10", "198.51.100.7", "203.0.113.9", "198.18.0.1"]) {
      expect(isPrivateIpAddress(address)).toBe(true);
    }
    // iana.org resolves to 192.0.43.8, which is public.
    for (const address of ["192.0.43.8", "198.51.1.1", "203.0.178.1"]) {
      expect(isPrivateIpAddress(address)).toBe(false);
    }
  });

  describe("validateUrl", () => {
    it("should accept valid HTTP URLs", () => {
      const result = validateUrl("http://example.com");
      expect(result.valid).toBe(true);
      expect(result.parsedUrl?.protocol).toBe("http:");
    });

    it("should accept valid HTTPS URLs", () => {
      const result = validateUrl("https://example.com");
      expect(result.valid).toBe(true);
      expect(result.parsedUrl?.protocol).toBe("https:");
    });

    it("should reject localhost URLs", () => {
      const result = validateUrl("http://localhost");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Localhost");
    });

    it("should reject loopback IP addresses", () => {
      const result = validateUrl("http://127.0.0.1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("loopback");
    });

    it("should reject private IP addresses", () => {
      const result = validateUrl("http://192.168.1.1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Private");
    });

    it("should reject cloud metadata endpoints", () => {
      const result = validateUrl("http://169.254.169.254");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("blocked");
    });

    it("should reject non-HTTP/HTTPS protocols", () => {
      const result = validateUrl("ftp://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTP and HTTPS");
    });

    it("should reject invalid URLs", () => {
      const result = validateUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("isPrivateNetworkDestination", () => {
    it("should detect private network destinations", () => {
      const url = new URL("http://192.168.1.1");
      expect(isPrivateNetworkDestination(url)).toBe(true);
    });

    it("should detect localhost as private", () => {
      const url = new URL("http://localhost");
      expect(isPrivateNetworkDestination(url)).toBe(true);
    });

    it("should detect metadata endpoints as private", () => {
      const url = new URL("http://169.254.169.254");
      expect(isPrivateNetworkDestination(url)).toBe(true);
    });

    it("should accept public URLs", () => {
      const url = new URL("https://example.com");
      expect(isPrivateNetworkDestination(url)).toBe(false);
    });
  });

  describe("captureSchema", () => {
    it("should validate valid capture input", () => {
      const input = {
        url: "https://example.com",
        viewport: "desktop",
      };
      const result = captureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL", () => {
      const input = {
        url: "not-a-url",
        viewport: "desktop",
      };
      const result = captureSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});