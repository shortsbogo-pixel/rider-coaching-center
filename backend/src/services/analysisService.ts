import orders from "../../../src/data/sampleOrders.json";
import riders from "../../../src/data/sampleRiders.json";
import type { OrderRecord } from "../../../src/types/order";
import type { RiderProfile } from "../../../src/types/rider";
import { buildRiderMetrics } from "../../../src/utils/scoring";
import { loadParsedOrders } from "./excelService";

export async function getAnalysisOrders() {
  const parsedOrders = await loadParsedOrders();
  return parsedOrders.length ? parsedOrders : (orders as OrderRecord[]);
}

export async function getRiderMetrics() {
  return buildRiderMetrics(await getAnalysisOrders(), riders as RiderProfile[]);
}
