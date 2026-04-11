import { Injectable } from '@nestjs/common';
import { RiskInput, RiskOutput } from './risk-engine.types';

@Injectable()
export class RiskEngineService {
  computeRisk(input: RiskInput): RiskOutput {
    // 1. Normalize core metrics (0–100)
    const perf = input.performance;
    const att = input.attendance;
    const eng = input.engagement;
    const risk = input.riskScore;

    // 2. Normalize deltas (already scaled)
    const dPerf = input.deltas.performance;
    const dAtt = input.deltas.attendance;
    const dEng = input.deltas.engagement;
    const dRisk = input.deltas.risk;

    // 3. Tier penalties (Tier 3 = worst)
    const tPerf = input.tiers.performance === 3 ? 15 : input.tiers.performance === 2 ? 5 : 0;
    const tAtt = input.tiers.attendance === 3 ? 15 : input.tiers.attendance === 2 ? 5 : 0;
    const tEng = input.tiers.engagement === 3 ? 15 : input.tiers.engagement === 2 ? 5 : 0;
    const tRisk = input.tiers.risk === 3 ? 20 : input.tiers.risk === 2 ? 10 : 0;

    // 4. Flags (binary signals)
    const fLowPerf = input.flags.lowPerformance ? 10 : 0;
    const fLowAtt = input.flags.lowAttendance ? 10 : 0;
    const fLowEng = input.flags.lowEngagement ? 10 : 0;
    const fHighRisk = input.flags.highRisk ? 20 : 0;

    // 5. Stability (negative = declining)
    const stabilityPenalty = input.stability < 0 ? Math.abs(input.stability) * 0.5 : 0;

    // 6. Composite risk score (0–100+)
    const compositeRisk =
      (100 - perf) * 0.25 +
      (100 - att) * 0.25 +
      (100 - eng) * 0.20 +
      risk * 0.30 +
      dPerf * 0.1 +
      dAtt * 0.1 +
      dEng * 0.1 +
      dRisk * 0.2 +
      tPerf + tAtt + tEng + tRisk +
      fLowPerf + fLowAtt + fLowEng + fHighRisk +
      stabilityPenalty;

    // 7. Category
    let category: 'low' | 'medium' | 'high' = 'low';
    if (compositeRisk >= 70) category = 'high';
    else if (compositeRisk >= 40) category = 'medium';

    // 8. Reasons (human-readable)
    const reasons: string[] = [];
    if (input.flags.highRisk) reasons.push('High risk score');
    if (input.flags.lowPerformance) reasons.push('Low performance');
    if (input.flags.lowAttendance) reasons.push('Low attendance');
    if (input.flags.lowEngagement) reasons.push('Low engagement');
    if (input.tiers.performance === 3) reasons.push('Performance Tier 3');
    if (input.tiers.attendance === 3) reasons.push('Attendance Tier 3');
    if (input.tiers.engagement === 3) reasons.push('Engagement Tier 3');
    if (input.tiers.risk === 3) reasons.push('Risk Tier 3');
    if (input.stability < 0) reasons.push('Negative stability trend');

    return {
      compositeRisk,
      category,
      reasons,
      stability: input.stability,
      deltas: { ...input.deltas },
    };
  }
}
