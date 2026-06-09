import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Alert } from "../shared/types.js";
import type { AlertRepository } from "./alertProcessor.js";

interface AlertRow {
  id: number;
  event_id: string;
  source: string;
  start_time: string;
  kp: number;
  severity: Alert["severity"];
  emergency_notification: number;
  raw: string;
  created_at: string;
}

export class SqliteAlertRepository implements AlertRepository {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    const resolvedPath = path.resolve(dbPath);
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
    this.db = new DatabaseSync(resolvedPath);
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        start_time TEXT NOT NULL,
        kp REAL NOT NULL,
        severity TEXT NOT NULL,
        emergency_notification INTEGER NOT NULL,
        raw TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async findByEventId(eventId: string): Promise<Alert | null> {
    const row = this.db
      .prepare("SELECT * FROM alerts WHERE event_id = ?")
      .get(eventId) as AlertRow | undefined;

    return row ? mapRowToAlert(row) : null;
  }

  async createAlert(alert: Alert): Promise<Alert> {
    const result = this.db.prepare(
      `INSERT INTO alerts (
        event_id,
        source,
        start_time,
        kp,
        severity,
        emergency_notification,
        raw
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      alert.event_id,
      alert.source,
      alert.startTime,
      alert.kp,
      alert.severity,
      alert.emergencyNotification ? 1 : 0,
      JSON.stringify(alert.raw)
    );

    const created = this.db
      .prepare("SELECT * FROM alerts WHERE id = ?")
      .get(result.lastInsertRowid) as AlertRow | undefined;

    if (!created) {
      throw new Error("Inserted alert could not be loaded");
    }

    return mapRowToAlert(created);
  }

  async listAlerts(): Promise<Alert[]> {
    const rows = this.db
      .prepare("SELECT * FROM alerts ORDER BY created_at DESC, id DESC")
      .all() as unknown as AlertRow[];

    return rows.map(mapRowToAlert);
  }
}

function mapRowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    event_id: row.event_id,
    source: row.source,
    startTime: row.start_time,
    kp: row.kp,
    severity: row.severity,
    emergencyNotification: row.emergency_notification === 1,
    raw: JSON.parse(row.raw),
    createdAt: row.created_at
  };
}
