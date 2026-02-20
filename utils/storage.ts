import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeightRecord } from '@/types';

const STORAGE_KEY = 'weight_records_v1';

/** 로컬 날짜를 YYYY-MM-DD 형식으로 반환 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
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
export async function upsertRecord(record: WeightRecord): Promise<WeightRecord[]> {
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
