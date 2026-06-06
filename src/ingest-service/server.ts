import express from "express";
import { DEFAULT_GST_QUEUE, connectRabbitWithRetry } from "../shared/rabbit.js";
import { defaultDateWindow, fetchGstEventsWithRetry, toGstMessage } from "./nasaClient.js";

const app = express();
app.use(express.json());

const port = Number(process.env.PORT ?? 3001);
const rabbitUrl = process.env.RABBITMQ_URL ?? "amqp://localhost:5672";
const queueName = process.env.GST_QUEUE ?? DEFAULT_GST_QUEUE;
const nasaApiKey = process.env.NASA_API_KEY ?? "DEMO_KEY";

const rabbitConnection = await connectRabbitWithRetry(rabbitUrl);
const channel = await rabbitConnection.createChannel();
await channel.assertQueue(queueName, { durable: true });

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "ingest-service" });
});

app.post("/gst", async (request, response, next) => {
  try {
    const fallbackWindow = defaultDateWindow();
    const startDate = String(request.body?.startDate ?? request.query.startDate ?? fallbackWindow.startDate);
    const endDate = String(request.body?.endDate ?? request.query.endDate ?? fallbackWindow.endDate);

    const nasaEvents = await fetchGstEventsWithRetry(startDate, endDate, nasaApiKey);
    const messages = nasaEvents.map(toGstMessage).filter((message): message is NonNullable<typeof message> => {
      return message !== null;
    });

    for (const message of messages) {
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        contentType: "application/json",
        persistent: true,
        messageId: message.event_id
      });
    }

    response.status(202).json({
      status: "accepted",
      sourceEvents: nasaEvents.length,
      publishedEvents: messages.length,
      queue: queueName,
      startDate,
      endDate
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("[ingest-service] request failed", error);
  response.status(502).json({
    error: "NASA DONKI ingestion failed",
    detail: error instanceof Error ? error.message : "unknown error"
  });
});

app.listen(port, () => {
  console.log(`[ingest-service] listening on port ${port}`);
});
