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
  customValues?: Record<string, number>; // 사용자 정의 수치
  customBoolValues?: Record<string, boolean>; // 사용자 정의 체크항목
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

/** 사용자 정의 수치 */
export type CustomMetric = {
  key: string;
  label: string;
  unit: string;
  color: string;
};

/** 사용자 정의 체크항목 */
export type CustomBoolMetric = {
  key: string;
  label: string;
  color: string;
  emoji?: string;
};

/** 사용자 정의 체크항목 색상 팔레트 */
export const CUSTOM_BOOL_COLORS = [
  "#E91E63",
  "#9C27B0",
  "#3F51B5",
  "#00BCD4",
  "#009688",
  "#8BC34A",
  "#FF5722",
  "#795548",
];

/** 기본 제공 선택 수치 목록 */
export const BUILTIN_OPTIONAL_METRICS: {
  key: MetricKey;
  label: string;
  unit: string;
}[] = [
  { key: "waist", label: "허리둘레", unit: "cm" },
  { key: "muscleMass", label: "골격근량", unit: "kg" },
  { key: "bodyFatPercent", label: "체지방률", unit: "%" },
  { key: "bodyFatMass", label: "체지방량", unit: "kg" },
];

/** 사용자 정의 수치 기본 색상 팔레트 */
export const CUSTOM_METRIC_COLORS = [
  "#00BCD4",
  "#795548",
  "#607D8B",
  "#FF5722",
  "#3F51B5",
  "#009688",
  "#CDDC39",
  "#FF4081",
  "#536DFE",
  "#69F0AE",
];

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

/** 사용자 설정 (키, 생년월일, 성별 등) */
export type UserSettings = {
  height?: number; // cm
  age?: number; // deprecated, 하위호환용
  birthDate?: string; // YYYY-MM-DD
  gender?: "male" | "female";
  swipeEnabled?: boolean; // 좌우 스와이프 탭 전환 (기본 false)
  lockEnabled?: boolean; // 앱 잠금 활성화
  lockPin?: string; // 4자리 PIN
  lockBiometric?: boolean; // 생체인증 사용
  /** 수치 입력 표시 여부 (기록 작성 시) — 미설정=true */
  metricInputVisibility?: Record<string, boolean>;
  /** 수치 표시 여부 (기록목록/그래프/캘린더) — 미설정=true */
  metricDisplayVisibility?: Record<string, boolean>;
  /** 사용자 정의 수치 목록 */
  customMetrics?: CustomMetric[];
  /** 사용자 정의 체크항목 목록 */
  customBoolMetrics?: CustomBoolMetric[];
  /** 자동 백업 주기 (일 단위, 기본 1) */
  backupIntervalDays?: number;
};
