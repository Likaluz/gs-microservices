import { describe, expect, it, vi } from "vitest";
import { InMemoryAlertRepository, processGstEvent } from "../src/alert-service/alertProcessor";
import { classifyGeomagneticStorm } from "../src/shared/risk";
import type { GstEventMessage } from "../src/shared/types";

describe("RN1 - severidade de tempestade geomagnetica", () => {
  it("classifica Kp=4 como low sem notificacao emergencial", () => {
    expect(classifyGeomagneticStorm(4)).toEqual({
      severity: "low",
      emergencyNotification: false
    });
  });

  it("classifica Kp=6 como moderate sem notificacao emergencial", () => {
    expect(classifyGeomagneticStorm(6)).toEqual({
      severity: "moderate",
      emergencyNotification: false
    });
  });
});

describe("RN1/RN3 - alerta severo e idempotencia", () => {
  it("classifica Kp=8 como severe e descarta duplicata por event_id", async () => {
    const repository = new InMemoryAlertRepository();
    const logger = { warn: vi.fn() };
    const message: GstEventMessage = {
      event_id: "GST-2026-001",
      source: "NASA_DONKI_GST",
      startTime: "2026-06-01T00:00Z",
      kp: 8,
      raw: { gstID: "GST-2026-001" }
    };

    const firstResult = await processGstEvent(message, repository, undefined, logger);
    const secondResult = await processGstEvent(message, repository, undefined, logger);
    const alerts = await repository.listAlerts();

    expect(firstResult.status).toBe("created");
    expect(firstResult).toMatchObject({
      alert: {
        severity: "severe",
        emergencyNotification: true
      }
    });
    expect(secondResult).toEqual({ status: "duplicate", event_id: "GST-2026-001" });
    expect(alerts).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith("[idempotency] duplicate event discarded: GST-2026-001");
  });
});
