import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "10s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"]
  }
};

const baseUrl = __ENV.BASE_URL || "http://localhost:8080";

export default function () {
  const response = http.get(`${baseUrl}/api/alerts`);

  check(response, {
    "GET /api/alerts returns 200": (res) => res.status === 200,
    "response has cache field": (res) => {
      try {
        return typeof res.json("cache") === "string";
      } catch {
        return false;
      }
    }
  });

  sleep(2);
}
