import type { RiderProfile } from "../types/rider";

export function extractBaseName(rawName: string): string {
  return rawName.trim().replace(/\d{4}$/, "");
}

export function matchRiderByName(rawName: string, riders: RiderProfile[]): RiderProfile | undefined {
  const normalized = rawName.trim();
  const baseName = extractBaseName(normalized);

  return riders.find((rider) => {
    return rider.name === normalized || rider.baseName === baseName || rider.aliases.includes(normalized);
  });
}
