import { WeightRecord } from "@/types";

/**
 * 공통 날짜/숫자 포맷 유틸리티
 * - 여러 탭 화면에서 중복 사용되던 헬퍼 함수들을 한곳에 모음
 */

/** 숫자를 2자리 문자열로 패딩 (예: 3 → "03") */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" → "YYYY년 M월 D일" */
export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

/** "YYYY-MM-DD" → "M/D" (차트 라벨용) */
export function fmtLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

/** "YYYY-MM-DD" → "YY.MM.DD" (짧은 포맷) */
export function fmtDateShort(dateStr: string): string {
  return dateStr.slice(2).replace(/-/g, ".");
}

/** 해당 월의 일수 반환 (month: 0-based) */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 해당 월 1일의 요일 인덱스 반환 (month: 0-based, 0=일요일) */
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** 날짜 문자열 → 주차 키 ("YYYY-WXX") */
export function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 날짜 문자열 → 월 키 ("YYYY-MM") */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** 월 키 → 차트 라벨 ("YY/MM") */
export function fmtMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y.slice(2)}/${m}`;
}

/** 주차 키 → 차트 라벨 ("YYWXX") */
export function fmtWeekLabel(key: string): string {
  const [y, w] = key.split("-W");
  return `${y.slice(2)}W${w}`;
}

/** 두 날짜 간 일수 차이 */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** YYYY-MM-DD 또는 YYYYMMDD 형식의 날짜 문자열 검증 */
export function isValidDateString(s: string): boolean {
  const normalized = normalizeDateString(s);
  if (!normalized) return false;
  const [y, m, d] = normalized.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/** YYYYMMDD → YYYY-MM-DD 변환, 이미 YYYY-MM-DD면 그대로 반환, 잘못된 형식이면 null */
export function normalizeDateString(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return null;
}

/** 생년월일로 만 나이 계산 */
export function calcAge(birthDate: string): number | null {
  if (!isValidDateString(birthDate)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - by;
  const monthDiff = today.getMonth() + 1 - bm;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd)) {
    age--;
  }
  return age >= 0 ? age : null;
}

/** HEX 컬러 → RGBA 문자열 */
export function hexToRGBA(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** WeightRecord에서 특정 메트릭 값 추출 (커스텀 수치 키도 지원) */
export function getMetricValue(r: WeightRecord, key: string): number | null {
  if (key === "weight") return r.weight > 0 ? r.weight : null;
  if (key === "waist") return r.waist ?? null;
  if (key === "muscleMass") return r.muscleMass ?? null;
  if (key === "bodyFatPercent") return r.bodyFatPercent ?? null;
  if (key === "bodyFatMass") return r.bodyFatMass ?? null;
  // 사용자 정의 수치 (customValues)
  return r.customValues?.[key] ?? null;
}

/** BMI 계산 + 라벨/색상 반환 */
export function getBmiInfo(
  weight: number,
  heightCm: number | undefined
): { bmi: number; label: string; color: string } | null {
  if (!heightCm || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weight / (heightM * heightM);
  let label: string, color: string;
  if (bmi < 18.5) {
    label = "저체중";
    color = "#3182CE";
  } else if (bmi < 23) {
    label = "정상";
    color = "#38A169";
  } else if (bmi < 25) {
    label = "과체중";
    color = "#DD6B20";
  } else {
    label = "비만";
    color = "#E53E3E";
  }
  return { bmi: Math.round(bmi * 10) / 10, label, color };
}

/** 요일 라벨 */
export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 운동 빈도·시간·강도 기반 일일 운동 칼로리 소비 산출
 * 공식: 칼로리 = MET × 체중(kg) × 시간(h)
 * @param freq  주당 운동 일수 (0~7)
 * @param mins  1일 운동 시간(분)
 * @param intensity 강도 1(가벼움) / 2(보통) / 3(고강도)
 * @param weight 체중(kg)
 * @returns 하루 평균 운동 칼로리 소비량
 */
export function calcDailyExerciseCal(
  freq: number,
  mins: number,
  intensity: number,
  weight: number
): number {
  // MET 값: 가벼움(걷기·요가) 3.5, 보통(조깅·근력) 5.5, 고강도(HIIT·고중량) 8.0
  const met = intensity === 3 ? 8.0 : intensity === 2 ? 5.5 : 3.5;
  // 1회 운동 칼로리 = MET × 체중 × 시간(h)
  const calPerSession = met * weight * (mins / 60);
  // 주당 총 → 하루 평균
  return (calPerSession * freq) / 7;
}

/**
 * 하루 권장 칼로리 및 PFC(탄수/단백질/지방) 계산
 *
 * BMR(Mifflin-St Jeor) + NEAT(비운동활동) + 운동 칼로리로 정확한 TDEE 산출.
 * 운동량(주당 총 시간)에 따라 단백질 g/kg 연동.
 * 목표(감량/증량/유지)에 따라 매크로 비율 동적 조절.
 *
 * @returns { kcal, protein, fat, carb, tdee, exerciseCal }
 */
export function calcDailyNutrition({
  weight,
  targetWeight,
  height,
  gender,
  birthDate,
  periodDays,
  exerciseFreq = 0,
  exerciseMins = 60,
  exerciseIntensity = 1,
  muscleMass,
  bodyFatPercent,
  targetMuscleMass,
  targetBodyFatPercent,
}: {
  weight: number;
  targetWeight: number;
  height: number;
  gender: "male" | "female";
  birthDate: string;
  periodDays: number;
  /** 주당 운동 일수 (0~7) */
  exerciseFreq?: number;
  /** 1일 운동 시간(분) */
  exerciseMins?: number;
  /** 강도 1(가벼움) / 2(보통) / 3(고강도) */
  exerciseIntensity?: number;
  /** 현재 골격근량 (kg) */
  muscleMass?: number;
  /** 현재 체지방률 (%) */
  bodyFatPercent?: number;
  /** 목표 골격근량 (kg) */
  targetMuscleMass?: number;
  /** 목표 체지방률 (%) */
  targetBodyFatPercent?: number;
}) {
  // 나이 계산
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  // ── BMR 계산 ──
  // 체지방률이 있으면 Katch-McArdle (제지방량 기반, 더 정확)
  // 없으면 Mifflin-St Jeor (체중 기반)
  let bmr: number;
  let leanMass: number | undefined; // 제지방량

  if (bodyFatPercent != null && bodyFatPercent > 0 && bodyFatPercent < 100) {
    leanMass = weight * (1 - bodyFatPercent / 100);
    // Katch-McArdle: BMR = 370 + 21.6 × LBM(kg)
    bmr = 370 + 21.6 * leanMass;
  } else {
    // Mifflin-St Jeor
    bmr =
      gender === "male"
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // NEAT(비운동 활동 열생산) = BMR × 0.15
  const neat = bmr * 0.15;

  // TEF(식사 열효과, Thermic Effect of Food) = BMR × 0.1
  const tef = bmr * 0.1;

  // 일일 운동 칼로리 소비
  const exerciseCal = calcDailyExerciseCal(
    exerciseFreq,
    exerciseMins,
    exerciseIntensity,
    weight
  );

  // TDEE = BMR + NEAT + TEF + 운동 칼로리
  const tdee = bmr + neat + tef + exerciseCal;

  // 목표 증감 칼로리 (1kg = 7700kcal)
  const totalDelta = (targetWeight - weight) * 7700;
  const dailyDelta = periodDays > 0 ? totalDelta / periodDays : 0;
  // 안전 범위 제한 (최대 ±1000kcal/일)
  const safeDelta = Math.max(-1000, Math.min(1000, dailyDelta));

  // ─── 운동량 + 목표 + 체성분에 따른 동적 매크로 ───
  const isLosing = targetWeight < weight;
  const isGaining = targetWeight > weight;

  // 근육 증가 목표 여부 (현재값이 없어도 목표가 설정되면 활성화)
  const wantsMuscleGain =
    targetMuscleMass != null &&
    (muscleMass == null || targetMuscleMass > muscleMass);

  // 체지방 감소 목표 여부 (현재값이 없어도 목표가 설정되면 활성화)
  const wantsFatLoss =
    targetBodyFatPercent != null &&
    (bodyFatPercent == null || targetBodyFatPercent < bodyFatPercent);

  // 근육 증가 목표 시 추가 칼로리 (근합성을 위한 에너지 잉여)
  let muscleSurplus = 0;
  if (wantsMuscleGain) {
    if (muscleMass != null && targetMuscleMass != null) {
      // 목표 근육량 증가분에 비례 (kg당 100kcal, 최대 300kcal)
      muscleSurplus = Math.min(300, Math.round((targetMuscleMass - muscleMass) * 100));
    } else {
      muscleSurplus = 150; // 현재 근육량 미기록 시 기본 보너스
    }
  }

  // 체지방 감소 목표 시 칼로리 적자 (체지방 감량분에 비례)
  let fatDeficit = 0;
  if (wantsFatLoss && targetBodyFatPercent != null) {
    // 현재 체지방률 → 목표 체지방률까지 감량할 체지방(kg)
    const currentBfp = bodyFatPercent ?? (isLosing ? 25 : 20); // 미입력 시 추정
    const fatLossKg = weight * (currentBfp - targetBodyFatPercent) / 100;
    if (fatLossKg > 0 && periodDays > 0) {
      // 지방 1kg = 7700kcal, 기간 내 분산
      const dailyFatDeficit = (fatLossKg * 7700) / periodDays;
      // 안전 범위 제한 (최대 500kcal/일)
      fatDeficit = Math.min(500, Math.max(0, Math.round(dailyFatDeficit)));
    }
  }

  // 하루 권장 칼로리 (최소 1200kcal)
  const kcal = Math.max(1200, Math.round(tdee + safeDelta + muscleSurplus - fatDeficit));

  // 주당 총 운동 시간(시)
  const weeklyExHours = (exerciseFreq * exerciseMins) / 60;

  // ── 단백질 (g/kg): 운동량 + 체성분 목표에 비례 ──
  let baseProtein: number;
  if (wantsMuscleGain && wantsFatLoss) {
    // 리컴포지션: 근육↑ 체지방↓ 동시 → 최고 단백질
    baseProtein = 2.0;
  } else if (wantsMuscleGain) {
    // 근육 증가 목표 → 높은 단백질
    baseProtein = 1.8;
  } else if (wantsFatLoss || isLosing) {
    // 체지방 감소 or 체중 감량 → 근손실 방지 위해 높은 단백질
    baseProtein = 1.6;
  } else if (isGaining) {
    baseProtein = 1.4;
  } else {
    baseProtein = 1.2; // 유지
  }

  // 운동량 보너스: 주당 운동시간에 비례 (최대 +0.8g/kg)
  // 강도 가중치: 가벼움 0.6, 보통 0.8, 고강도 1.0
  const intensityWeight =
    exerciseIntensity === 3 ? 1.0 : exerciseIntensity === 2 ? 0.8 : 0.6;
  const proteinBonus = Math.min(0.8, weeklyExHours * intensityWeight * 0.08);

  // 근육량이 많으면 (체중 대비) 단백질 추가 보너스
  let muscleBonus = 0;
  if (muscleMass != null && weight > 0) {
    const muscleRatio = muscleMass / weight;
    // 골격근 비율 40% 이상이면 추가 단백질 (최대 +0.3g/kg)
    if (muscleRatio > 0.4) {
      muscleBonus = Math.min(0.3, (muscleRatio - 0.4) * 3);
    }
  }

  const proteinPerKg = Math.min(2.8, baseProtein + proteinBonus + muscleBonus);

  // ── 지방 비율: 운동 + 체성분 목표에 따라 조절 ──
  let baseFatRatio: number;
  if (wantsFatLoss) {
    baseFatRatio = 0.22; // 체지방 감소 목표 → 지방 비율 낮게
  } else if (isLosing) {
    baseFatRatio = 0.25;
  } else if (wantsMuscleGain) {
    baseFatRatio = 0.25; // 근육 증가 시 탄수 에너지 확보 위해 지방 약간 낮게
  } else if (isGaining) {
    baseFatRatio = 0.27;
  } else {
    baseFatRatio = 0.3;
  }
  // 운동량이 많을수록 지방 비율 감소 (탄수 에너지 필요↑), 최대 -0.08
  const fatReduction = Math.min(0.08, weeklyExHours * 0.008);
  const fatRatio = Math.max(0.18, baseFatRatio - fatReduction);

  // 단백질(g) — 제지방량 기반 계산도 가능하면 활용
  let proteinG: number;
  if (leanMass != null && (wantsMuscleGain || wantsFatLoss)) {
    // 제지방량 기반 단백질: LBM × 보정 계수
    const lbmProteinPerKg = proteinPerKg * (weight / leanMass);
    proteinG = Math.round(leanMass * Math.min(3.3, lbmProteinPerKg));
  } else {
    proteinG = Math.round(weight * proteinPerKg);
  }
  const proteinCal = proteinG * 4;

  // 지방(g)
  const fat = Math.round((kcal * fatRatio) / 9);
  const fatCal = fat * 9;

  // 탄수화물(g) = 나머지
  const carb = Math.max(0, Math.round((kcal - proteinCal - fatCal) / 4));

  // 안전 보정: 단백질+지방이 총 칼로리 초과 시 비율 재조정
  if (proteinCal + fatCal > kcal) {
    // 체성분 목표에 따라 안전 비율 다르게
    const pRatio = wantsMuscleGain ? 0.4 : wantsFatLoss ? 0.38 : 0.35;
    const fRatio = wantsFatLoss ? 0.22 : 0.25;
    const cRatio = 1 - pRatio - fRatio;
    return {
      kcal,
      protein: Math.round((kcal * pRatio) / 4),
      fat: Math.round((kcal * fRatio) / 9),
      carb: Math.round((kcal * cRatio) / 4),
      tdee: Math.round(tdee),
      exerciseCal: Math.round(exerciseCal),
    };
  }

  return {
    kcal,
    protein: proteinG,
    fat,
    carb,
    tdee: Math.round(tdee),
    exerciseCal: Math.round(exerciseCal),
  };
}
