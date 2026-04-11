import { HttpService } from "@nestjs/axios";
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import type { JwtPayload } from "../common/types/jwt-payload";
import type { AIInsightsRequest } from "./dto/ai-request.dto";
import type { ClassInsightsResponse } from "./dto/class-insights.dto";
import type { StudentInsightsResponse } from "./dto/student-insights.dto";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly analytics: AnalyticsService,
  ) {}

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  private normalizeAiPayload(data: unknown): ClassInsightsResponse {
    if (!data || typeof data !== "object") {
      throw new BadGatewayException("AI service returned an empty or invalid body");
    }
    const o = data as Record<string, unknown>;
    const summary = o.summary;
    const risks = o.risks;
    const recommendations = o.recommendations;
    if (typeof summary !== "string") {
      throw new BadGatewayException("AI response missing string `summary`");
    }
    if (!isStringArray(risks)) {
      throw new BadGatewayException("AI response missing string array `risks`");
    }
    if (!isStringArray(recommendations)) {
      throw new BadGatewayException("AI response missing string array `recommendations`");
    }
    return { summary, risks, recommendations };
  }

  private async postGenerateInsights(request: AIInsightsRequest): Promise<ClassInsightsResponse> {
    const url = `${this.getAiBaseUrl()}/generate-insights`;
    const timeout = this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000;
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(url, request, {
          headers: aiHttpHeaders(this.config),
          timeout,
        }),
      );
      return this.normalizeAiPayload(response.data);
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const body =
          typeof err.response?.data === "string"
            ? err.response.data
            : JSON.stringify(err.response?.data ?? {});
        this.logger.warn(`AI service POST failed: ${status ?? err.code} ${body.slice(0, 500)}`);
        throw new BadGatewayException(
          status ? `AI service error (${status})` : "AI service unreachable",
        );
      }
      if (err instanceof BadGatewayException) throw err;
      this.logger.error(err instanceof Error ? err.message : String(err));
      throw new ServiceUnavailableException("Failed to generate insights");
    }
  }

  async getClassInsights(classId: string, user: JwtPayload): Promise<ClassInsightsResponse> {
    const analytics = await this.analytics.getClassAnalytics(classId, user);
    const payload: AIInsightsRequest = {
      type: "class",
      analytics: analytics as unknown as Record<string, unknown>,
      metadata: { schoolId: user.schoolId, classId },
    };
    return this.postGenerateInsights(payload);
  }

  async getStudentInsights(studentId: string, user: JwtPayload): Promise<StudentInsightsResponse> {
    const analytics = await this.analytics.getStudentAnalytics(studentId, user);
    const payload: AIInsightsRequest = {
      type: "student",
      analytics: analytics as unknown as Record<string, unknown>,
      metadata: { schoolId: user.schoolId, studentId },
    };
    return this.postGenerateInsights(payload);
  }
}
