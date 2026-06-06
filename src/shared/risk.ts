import type { RiskClassification } from "./types.js";

export function classifyGeomagneticStorm(kp: number): RiskClassification {
  if (!Number.isFinite(kp) || kp < 0) {
    throw new Error(`Invalid Kp index: ${kp}`);
  }

  if (kp <= 4) {
    return { severity: "low", emergencyNotification: false };
  }

  if (kp <= 7) {
    return { severity: "moderate", emergencyNotification: false };
  }

  return { severity: "severe", emergencyNotification: true };
}
