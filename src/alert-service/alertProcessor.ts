import { classifyGeomagneticStorm } from "../shared/risk.js";
import type { Alert, GstEventMessage } from "../shared/types.js";

export interface AlertRepository {
  findByEventId(eventId: string): Promise<Alert | null>;
  createAlert(alert: Alert): Promise<Alert>;
  listAlerts(): Promise<Alert[]>;
}

export interface DuplicateAwareLogger {
  warn(message: string): void;
}

export type ProcessResult =
  | { status: "created"; alert: Alert }
  | { status: "duplicate"; event_id: string };

export async function processGstEvent(
  message: GstEventMessage,
  repository: AlertRepository,
  onNewAlert?: () => Promise<void>,
  logger: DuplicateAwareLogger = console
): Promise<ProcessResult> {
  const existing = await repository.findByEventId(message.event_id);
  if (existing) {
    logger.warn(`[idempotency] duplicate event discarded: ${message.event_id}`);
    return { status: "duplicate", event_id: message.event_id };
  }

  const risk = classifyGeomagneticStorm(message.kp);
  const alert = await repository.createAlert({
    event_id: message.event_id,
    source: message.source,
    startTime: message.startTime,
    kp: message.kp,
    severity: risk.severity,
    emergencyNotification: risk.emergencyNotification,
    raw: message.raw
  });

  await onNewAlert?.();
  return { status: "created", alert };
}

export class InMemoryAlertRepository implements AlertRepository {
  private readonly alerts = new Map<string, Alert>();

  async findByEventId(eventId: string): Promise<Alert | null> {
    return this.alerts.get(eventId) ?? null;
  }

  async createAlert(alert: Alert): Promise<Alert> {
    const savedAlert = {
      ...alert,
      id: this.alerts.size + 1,
      createdAt: new Date().toISOString()
    };
    this.alerts.set(alert.event_id, savedAlert);
    return savedAlert;
  }

  async listAlerts(): Promise<Alert[]> {
    return [...this.alerts.values()];
  }
}
