import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Example: backend → AI service with shared secret (never expose this key to the browser).
 * Wire this when Nest calls POST /predict/student_risk on the Python service.
 */
@Injectable()
export class AiInternalClient {
  private readonly logger = new Logger(AiInternalClient.name);

  constructor(private readonly config: ConfigService) {}

  async postPredictStudentRisk(body: unknown): Promise<unknown> {
    const base = this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
    const key = this.config.get<string>("INTERNAL_API_KEY");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers["X-Internal-Key"] = key;

    const res = await fetch(`${base}/predict/student_risk`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      this.logger.warn(`AI service ${res.status}: ${t}`);
      throw new Error(`AI service error: ${res.status}`);
    }
    return res.json();
  }
}
