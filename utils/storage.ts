import { WeightRecord } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "weight_records_v1";

/** 로컬 날짜를 YYYY-MM-DD 형식으로 반환 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 저장된 모든 기록 불러오기 */
export async function loadRecords(): Promise<WeightRecord[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as WeightRecord[];
  } catch {
    return [];
  }
}

/** 기록 전체 저장 */
export async function saveRecords(records: WeightRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** 기록 추가 또는 날짜가 같으면 업데이트 */
export async function upsertRecord(
  record: WeightRecord
): Promise<WeightRecord[]> {
  const records = await loadRecords();
  const idx = records.findIndex((r) => r.date === record.date);
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  await saveRecords(records);
  return records;
}

/** 특정 날짜 기록 삭제 */
export async function deleteRecord(date: string): Promise<WeightRecord[]> {
  const records = await loadRecords();
  const filtered = records.filter((r) => r.date !== date);
  await saveRecords(filtered);
  return filtered;
}

/** 전체 기록 삭제 */
export async function clearAllRecords(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * 약 1년치 더미 데이터 생성 및 저장
 * - 일주일마다 0~7일 랜덤 기록
 * - 몸무게: 75kg 근방에서 완만한 변화 + 노이즈
 * - 허리: 82cm 근방, 70% 확률로 기록
 * - 운동: 40% 확률, 음주: 25% 확률
 */
export async function seedDummyData(): Promise<WeightRecord[]> {
  const rand = (min: number, max: number) =>
    Math.round((Math.random() * (max - min) + min) * 10) / 10;

  const today = new Date();
  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 1);

  // 날짜별 후보 수집 (오늘 제외)
  const allDates: string[] = [];
  const cur = new Date(startDate);
  cur.setDate(cur.getDate() + 1); // 시작일 다음날부터
  while (cur < today) {
    allDates.push(getLocalDateString(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }

  // 주 단위로 묶어 0~7일 랜덤 선택
  const selectedDates: string[] = [];
  for (let i = 0; i < allDates.length; i += 7) {
    const week = allDates.slice(i, i + 7);
    const count = Math.floor(Math.random() * 8); // 0~7
    // 주 내에서 랜덤하게 count개 선택
    const shuffled = [...week].sort(() => Math.random() - 0.5);
    selectedDates.push(...shuffled.slice(0, count));
  }
  selectedDates.sort(); // 날짜 오름차순

  // 기록 생성 (몸무게 트렌드: 완만하게 ±3kg 랜덤워크)
  let baseWeight = 75.0;
  const records: WeightRecord[] = selectedDates.map((date, idx) => {
    // 매 30개마다 기저 체중 살짝 이동
    if (idx % 30 === 0) {
      baseWeight += rand(-0.8, 0.8);
    }
    const weight = Math.round((baseWeight + rand(-1.5, 1.5)) * 10) / 10;
    const hasWaist = Math.random() < 0.7;
    const waist = hasWaist ? rand(79, 87) : undefined;

    return {
      id: date,
      date,
      weight: Math.max(60, Math.min(100, weight)),
      waist,
      exercised: Math.random() < 0.4,
      drank: Math.random() < 0.25,
    };
  });

  await saveRecords(records);
  return records;
}
