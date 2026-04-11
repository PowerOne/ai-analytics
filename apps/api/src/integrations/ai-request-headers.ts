import { ConfigService } from "@nestjs/config";

/** Headers for all outbound calls to the internal AI service (includes X-Internal-Key when configured). */
export function aiHttpHeaders(config: ConfigService): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = config.get<string>("INTERNAL_API_KEY")?.trim();
  if (key) headers["X-Internal-Key"] = key;
  return headers;
}
