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

/** YYYY-MM-DD 형식의 날짜 문자열 검증 */
export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
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
