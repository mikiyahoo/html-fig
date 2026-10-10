import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIpAddress, isPrivateNetworkDestination } from "./url-validator";

/** Resolve hostnames before capture and fail closed if any answer is non-public. */
export async function validatePublicNetworkUrl(url: URL): Promise<boolean> {
  if (isPrivateNetworkDestination(url)) return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return !isPrivateIpAddress(hostname);
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateIpAddress(address));
  } catch {
    return false;
  }
}
