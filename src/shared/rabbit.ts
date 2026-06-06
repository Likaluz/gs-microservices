import amqp from "amqplib";
import type { ChannelModel } from "amqplib";

export const DEFAULT_GST_QUEUE = "space-weather.gst";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectRabbitWithRetry(
  url: string,
  attempts = 30,
  delayMs = 2000
): Promise<ChannelModel> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await amqp.connect(url);
    } catch (error) {
      lastError = error;
      console.warn(
        `[rabbitmq] connection attempt ${attempt}/${attempts} failed; retrying in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
