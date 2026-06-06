export type StormSeverity = "low" | "moderate" | "severe";

export interface RiskClassification {
  severity: StormSeverity;
  emergencyNotification: boolean;
}

export interface GstEventMessage {
  event_id: string;
  source: "NASA_DONKI_GST";
  startTime: string;
  kp: number;
  raw: unknown;
}

export interface Alert {
  id?: number;
  event_id: string;
  source: string;
  startTime: string;
  kp: number;
  severity: StormSeverity;
  emergencyNotification: boolean;
  raw: unknown;
  createdAt?: string;
}
