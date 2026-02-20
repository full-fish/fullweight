export type WeightRecord = {
  id: string;
  date: string; // YYYY-MM-DD (로컬 날짜)
  weight: number; // kg
  waist?: number; // cm (선택)
  muscleMass?: number; // 골격근량 kg (선택)
  bodyFatPercent?: number; // 체지방률 % (선택)
  bodyFatMass?: number; // 체지방량 kg (선택)
  exercised: boolean;
  drank: boolean;
  photoUri?: string; // 바디 사진 로컬 URI (선택)
};

/** 그래프에서 선택 가능한 수치 종류 */
export type MetricKey =
  | "weight"
  | "waist"
  | "muscleMass"
  | "bodyFatPercent"
  | "bodyFatMass";

export const METRIC_LABELS: Record<MetricKey, string> = {
  weight: "몸무게",
  waist: "허리둘레",
  muscleMass: "골격근량",
  bodyFatPercent: "체지방률",
  bodyFatMass: "체지방량",
};

export const METRIC_UNITS: Record<MetricKey, string> = {
  weight: "kg",
  waist: "cm",
  muscleMass: "kg",
  bodyFatPercent: "%",
  bodyFatMass: "kg",
};

export const METRIC_COLORS: Record<MetricKey, string> = {
  weight: "#4CAF50",
  waist: "#FF9800",
  muscleMass: "#2196F3",
  bodyFatPercent: "#E91E63",
  bodyFatMass: "#9C27B0",
};

/** 그래프 기간 모드 */
export type PeriodMode = "daily" | "weekly" | "monthly" | "custom";

/** 챌린지 (목표 설정) */
export type Challenge = {
  id: string;
  startWeight?: number;
  startMuscleMass?: number;
  startBodyFatMass?: number;
  startBodyFatPercent?: number;
  targetWeight?: number;
  targetMuscleMass?: number;
  targetBodyFatMass?: number;
  targetBodyFatPercent?: number;
  startDate: string;
  endDate: string;
  createdAt: string;
};

/** 완료된 챌린지 기록 */
export type ChallengeHistory = {
  id: string;
  challenge: Challenge;
  endWeight?: number;
  endMuscleMass?: number;
  endBodyFatMass?: number;
  endBodyFatPercent?: number;
  overallProgress: number | null;
  completedAt: string;
};

/** 사용자 설정 (키, 나이 등) */
export type UserSettings = {
  height?: number; // cm
  age?: number;
};
