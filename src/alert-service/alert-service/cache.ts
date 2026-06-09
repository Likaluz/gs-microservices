import type { Redis } from "ioredis";
import type { Alert } from "../shared/types.js";
import type { AlertRepository } from "./alertProcessor.js";

export const ALERTS_CACHE_KEY = "alerts:list";

export interface AlertsCacheResult {
  cache: "hit" | "miss";
  data: Alert[];
}

export async function getAlertsCacheAside(
  repository: AlertRepository,
  redis: Redis,
  ttlSeconds: number
): Promise<AlertsCacheResult> {
  const cachedAlerts = await redis.get(ALERTS_CACHE_KEY);
  if (cachedAlerts) {
    console.log("[redis] cache hit for GET /alerts");
    return { cache: "hit", data: JSON.parse(cachedAlerts) as Alert[] };
  }

  console.log("[redis] cache miss for GET /alerts");
  const alerts = await repository.listAlerts();
  await redis.set(ALERTS_CACHE_KEY, JSON.stringify(alerts), "EX", ttlSeconds);

  return { cache: "miss", data: alerts };
}
