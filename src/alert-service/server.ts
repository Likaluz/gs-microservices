import express from "express";
import { Redis } from "ioredis";
import type { ConsumeMessage } from "amqplib";
import { DEFAULT_GST_QUEUE, connectRabbitWithRetry } from "../shared/rabbit.js";
import type { GstEventMessage } from "../shared/types.js";
import { processGstEvent } from "./alertProcessor.js";
import { ALERTS_CACHE_KEY, getAlertsCacheAside } from "./cache.js";
import { SqliteAlertRepository } from "./sqliteAlertRepository.js";

const app = express();
app.use(express.json());

const port = Number(process.env.PORT ?? 3002);
const rabbitUrl = process.env.RABBITMQ_URL ?? "amqp://localhost:5672";
const queueName = process.env.GST_QUEUE ?? DEFAULT_GST_QUEUE;
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const cacheTtlSeconds = Number(process.env.ALERTS_CACHE_TTL_SECONDS ?? 60);
const dbPath = process.env.DB_PATH ?? "./alerts.db";

const repository = new SqliteAlertRepository(dbPath);
await repository.init();

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false
});

const rabbitConnection = await connectRabbitWithRetry(rabbitUrl);
const channel = await rabbitConnection.createChannel();
await channel.assertQueue(queueName, { durable: true });
await channel.prefetch(10);

await channel.consume(queueName, async (message: ConsumeMessage | null) => {
  if (!message) {
    return;
  }

  try {
    const parsed = JSON.parse(message.content.toString()) as GstEventMessage;
    const result = await processGstEvent(
      parsed,
      repository,
      async () => {
        await redis.del(ALERTS_CACHE_KEY);
        console.log("[redis] alerts cache invalidated after new alert");
      },
      console
    );

    console.log(`[alert-service] processed ${parsed.event_id}: ${result.status}`);
    channel.ack(message);
  } catch (error) {
    console.error("[alert-service] failed to process queue message", error);
    channel.nack(message, false, false);
  }
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "alert-service" });
});

app.get("/alerts", async (_request, response, next) => {
  try {
    const alerts = await getAlertsCacheAside(repository, redis, cacheTtlSeconds);
    response.json(alerts);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("[alert-service] request failed", error);
  response.status(500).json({
    error: "Alert service failed",
    detail: error instanceof Error ? error.message : "unknown error"
  });
});

app.listen(port, () => {
  console.log(`[alert-service] listening on port ${port}`);
});
