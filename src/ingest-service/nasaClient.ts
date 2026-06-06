import axios from "axios";
import type { GstEventMessage } from "../shared/types.js";

interface NasaKpIndex {
  kpIndex?: number | string;
  observedTime?: string;
}

interface NasaGstEvent {
  gstID?: string;
  startTime?: string;
  allKpIndex?: NasaKpIndex[];
  [key: string]: unknown;
}

const DONKI_GST_URL = "https://api.nasa.gov/DONKI/GST";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function defaultDateWindow(today = new Date()): { startDate: string; endDate: string } {
  const end = new Date(today);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 30);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

export async function fetchGstEventsWithRetry(
  startDate: string,
  endDate: string,
  apiKey: string,
  maxAttempts = 3
): Promise<NasaGstEvent[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.get<NasaGstEvent[]>(DONKI_GST_URL, {
        params: { startDate, endDate, api_key: apiKey },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }

      const delayMs = 500 * 2 ** (attempt - 1);
      console.warn(
        `[nasa] DONKI GST request failed on attempt ${attempt}/${maxAttempts}; retrying in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export function toGstMessage(event: NasaGstEvent): GstEventMessage | null {
  const kpValues = (event.allKpIndex ?? [])
    .map((kp) => Number(kp.kpIndex))
    .filter((kp) => Number.isFinite(kp));

  if (!event.gstID || !event.startTime || kpValues.length === 0) {
    console.warn(`[nasa] skipping GST event without gstID/startTime/Kp data: ${event.gstID ?? "unknown"}`);
    return null;
  }

  return {
    event_id: event.gstID,
    source: "NASA_DONKI_GST",
    startTime: event.startTime,
    kp: Math.max(...kpValues),
    raw: event
  };
}
