import { WeightRecord } from "@/types";
import { loadRecords, saveRecords } from "@/utils/storage";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";

/** 인바디 CSV 한 행에서 추출할 데이터 */
type InBodyRow = {
  date: string; // YYYY-MM-DD
  weight: number;
  muscleMass: number;
  bodyFatMass: number;
  bodyFatPercent: number;
  bmi?: number;
  inbodyScore?: number;
};

/**
 * 인바디 CSV 날짜 문자열 → YYYY-MM-DD 변환
 * 형식: """20260219085255""" → "2026-02-19"
 */
function parseInBodyDate(raw: string): string | null {
  // 따옴표 제거
  const cleaned = raw.replace(/"/g, "").trim();
  if (cleaned.length < 8) return null;
  const y = cleaned.slice(0, 4);
  const m = cleaned.slice(4, 6);
  const d = cleaned.slice(6, 8);
  return `${y}-${m}-${d}`;
}

/** "-" 또는 빈 값이면 undefined, 그 외 숫자로 파싱 */
function parseNum(val: string | undefined): number | undefined {
  if (!val || val.trim() === "-" || val.trim() === "") return undefined;
  const n = parseFloat(val.trim());
  return isNaN(n) ? undefined : n;
}

/**
 * 인바디 CSV 텍스트를 파싱하여 InBodyRow[] 반환
 *
 * 헤더:
 * 날짜(0), 측정장비(1), 인바디나이(2), 인바디점수(3), ... ,
 * 체중(19), 골격근량(20), 근육량(21), 체지방량(22),
 * BMI(23), 체지방률(24), ... , 내장지방레벨(28), ...
 */
function parseInBodyCSV(csvText: string): InBodyRow[] {
  const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // 헤더 행에서 인덱스 찾기
  const header = lines[0].split(",");
  const idx = {
    date: header.findIndex((h) => h.includes("날짜")),
    score: header.findIndex((h) => h.includes("인바디점수")),
    weight: header.findIndex((h) => h.startsWith("체중")),
    muscleMass: header.findIndex((h) => h.startsWith("골격근량")),
    bodyFatMass: header.findIndex((h) => h.startsWith("체지방량")),
    bmi: header.findIndex((h) => h.startsWith("BMI")),
    bodyFatPercent: header.findIndex((h) => h.startsWith("체지방률")),
  };

  if (idx.date < 0 || idx.weight < 0) return [];

  const rows: InBodyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const date = parseInBodyDate(cols[idx.date] ?? "");
    if (!date) continue;

    const weight = parseNum(cols[idx.weight]);
    if (!weight) continue; // 체중 없으면 스킵

    const muscleMass = parseNum(cols[idx.muscleMass]);
    const bodyFatMass = parseNum(cols[idx.bodyFatMass]);
    const bodyFatPercent = parseNum(cols[idx.bodyFatPercent]);
    const bmi = parseNum(cols[idx.bmi]);
    const inbodyScore = parseNum(cols[idx.score]);

    rows.push({
      date,
      weight,
      muscleMass: muscleMass ?? 0,
      bodyFatMass: bodyFatMass ?? 0,
      bodyFatPercent: bodyFatPercent ?? 0,
      bmi,
      inbodyScore,
    });
  }

  return rows;
}

/**
 * 인바디 데이터를 기존 기록에 병합
 * - 같은 날짜: 인바디 필드(체중, 골격근량, 체지방량, 체지방률)로 덮어쓰기
 *   + 기존에만 있는 필드(허리둘레, 운동, 음주, 사진 등)는 유지
 * - 새 날짜: 인바디 데이터로 새 기록 생성
 */
function mergeInBodyData(
  existingRecords: WeightRecord[],
  inbodyRows: InBodyRow[]
): { merged: WeightRecord[]; newCount: number; updatedCount: number } {
  const recordMap = new Map<string, WeightRecord>();

  // 기존 기록을 날짜별로 맵에 넣기
  for (const r of existingRecords) {
    recordMap.set(r.date, { ...r });
  }

  let newCount = 0;
  let updatedCount = 0;

  for (const row of inbodyRows) {
    const existing = recordMap.get(row.date);

    if (existing) {
      // 기존 기록에 인바디 데이터를 덮어쓰기 (겹치는 필드만)
      existing.weight = row.weight;
      existing.muscleMass = row.muscleMass || existing.muscleMass;
      existing.bodyFatMass = row.bodyFatMass || existing.bodyFatMass;
      existing.bodyFatPercent = row.bodyFatPercent || existing.bodyFatPercent;
      // 기존에만 있는 필드 (waist, exercised, drank, photoUri 등)는 그대로 유지
      recordMap.set(row.date, existing);
      updatedCount++;
    } else {
      // 새 기록 생성
      const newRecord: WeightRecord = {
        id: `inbody_${row.date}_${Date.now()}`,
        date: row.date,
        weight: row.weight,
        muscleMass: row.muscleMass || undefined,
        bodyFatMass: row.bodyFatMass || undefined,
        bodyFatPercent: row.bodyFatPercent || undefined,
        exercised: false,
        drank: false,
      };
      recordMap.set(row.date, newRecord);
      newCount++;
    }
  }

  // 날짜 오름차순 정렬
  const merged = [...recordMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return { merged, newCount, updatedCount };
}

/**
 * 인바디 CSV 파일 선택 → 파싱 → 기존 기록에 병합 → 저장
 * @returns { newCount, updatedCount, totalInBody } 결과 요약
 */
export async function importInBodyCSV(): Promise<{
  newCount: number;
  updatedCount: number;
  totalInBody: number;
}> {
  // 파일 선택 다이얼로그
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "*/*"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error("파일 선택이 취소되었습니다.");
  }

  const fileUri = result.assets[0].uri;

  // CSV 읽기
  const csvText = await readAsStringAsync(fileUri);

  // 파싱
  const inbodyRows = parseInBodyCSV(csvText);
  if (inbodyRows.length === 0) {
    throw new Error(
      "인바디 데이터를 찾을 수 없습니다.\nCSV 파일 형식을 확인해주세요."
    );
  }

  // 기존 기록 불러오기 & 병합
  const existingRecords = await loadRecords();
  const { merged, newCount, updatedCount } = mergeInBodyData(
    existingRecords,
    inbodyRows
  );

  // 저장
  await saveRecords(merged);

  return { newCount, updatedCount, totalInBody: inbodyRows.length };
}
