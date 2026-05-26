import type { RiderProfile } from "../types/rider";

function normalizeRiderName(rawName: string): string {
  return rawName
    .trim()
    .replace(/[\s\u00A0]+/g, " ")
    .replace(/[-_–—]+/g, "")
    .replace(/\s+$/g, "")
    .replace(/^\s+/g, "");
}

export function extractBaseName(rawName: string): string {
  const normalized = normalizeRiderName(rawName);
  return normalized.replace(/\s*\d{3,6}$/, "").trim();
}

export function getComparableName(rawName: string): string {
  return normalizeRiderName(rawName).replace(/\d{3,6}$/, "").trim();
}

export function matchRiderByName(rawName: string, riders: RiderProfile[]): RiderProfile | undefined {
  const normalized = normalizeRiderName(rawName);
  const baseName = extractBaseName(normalized);
  const comparableName = getComparableName(normalized);

  return riders.find((rider) => {
    const riderName = normalizeRiderName(rider.name);
    const riderBaseName = normalizeRiderName(rider.baseName);
    const aliases = new Set(rider.aliases.map(normalizeRiderName));

    return (
      riderName === normalized ||
      riderBaseName === baseName ||
      aliases.has(normalized) ||
      riderName === comparableName ||
      riderBaseName === comparableName ||
      aliases.has(comparableName)
    );
  });
}
