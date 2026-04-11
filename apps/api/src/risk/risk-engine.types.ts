export interface RiskInput {
    studentId: string;
    classId: string;
  
    performance: number;
    attendance: number;
    engagement: number;
    riskScore: number;
  
    deltas: {
      performance: number;
      attendance: number;
      engagement: number;
      risk: number;
    };
  
    tiers: {
      performance: number;
      attendance: number;
      engagement: number;
      risk: number;
    };
  
    flags: {
      lowPerformance: boolean;
      lowAttendance: boolean;
      lowEngagement: boolean;
      highRisk: boolean;
    };
  
    stability: number;
  }
  
  export interface RiskOutput {
    compositeRisk: number;
    category: "low" | "medium" | "high";
    reasons: string[];
    /** Echo from input for persistence */
    stability: number;
    deltas: RiskInput["deltas"];
  }
  