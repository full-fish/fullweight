export type WeightRecord = {
  id: string;
  date: string; // YYYY-MM-DD (로컬 날짜)
  weight: number; // kg
  waist?: number; // cm (선택)
  muscleMass?: number; // 골격근량 kg (선택)
  bodyFat?: number; // 체지방률 % 또는 체지방량 kg (선택)
  bodyFatUnit?: "percent" | "kg"; // 체지방 단위 (기본 percent)
  exercised: boolean;
  drank: boolean;
};

/** 그래프에서 선택 가능한 수치 종류 */
export type MetricKey = "weight" | "waist" | "muscleMass" | "bodyFat";

export const METRIC_LABELS: Record<MetricKey, string> = {
  weight: "몸무게",
  waist: "허리둘레",
  muscleMass: "골격근량",
  bodyFat: "체지방",
};

export const METRIC_UNITS: Record<MetricKey, string> = {
  weight: "kg",
  waist: "cm",
  muscleMass: "kg",
  bodyFat: "%/kg",
};

export const METRIC_COLORS: Record<MetricKey, string> = {
  weight: "#4CAF50",
  waist: "#FF9800",
  muscleMass: "#2196F3",
  bodyFat: "#E91E63",
};

/** 그래프 기간 모드 */
export type PeriodMode = "daily" | "weekly" | "monthly" | "custom";
