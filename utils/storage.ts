import {
  Challenge,
  ChallengeHistory,
  UserSettings,
  WeightRecord,
} from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "weight_records_v1";
const CHALLENGE_KEY = "weight_challenge_v1";
const CHALLENGE_HISTORY_KEY = "weight_challenge_history_v1";
const USER_SETTINGS_KEY = "user_settings_v1";

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

/** 전체 기록 삭제 (사용자 정의 항목 포함) */
export async function clearAllRecords(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  // 사용자 정의 항목들도 삭제
  const settings = await loadUserSettings();
  const {
    customMetrics,
    customBoolMetrics,
    metricInputVisibility,
    metricDisplayVisibility,
    ...rest
  } = settings;
  await saveUserSettings(rest);
}

/**
 * 약 3년치 더미 데이터 생성 및 저장
 * - 일주일마다 1~7일 랜덤 기록
 * - 몸무게: 78kg 근방에서 완만한 변화 + 노이즈
 * - 허리: 82cm 근방, 65% 확률로 기록
 * - 골격근량: 60% 확률
 * - 체지방률: 55% 확률
 * - 체지방량: 45% 확률
 * - 운동: 40% 확률, 음주: 25% 확률
 * - 챌린지 히스토리 10개 (6 성공, 4 실패)
 */
export async function seedDummyData(): Promise<WeightRecord[]> {
  const rand = (min: number, max: number) =>
    Math.round((Math.random() * (max - min) + min) * 10) / 10;
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const today = new Date();
  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 3);

  // 날짜별 후보 수집 (오늘 제외)
  const allDates: string[] = [];
  const cur = new Date(startDate);
  cur.setDate(cur.getDate() + 1);
  while (cur < today) {
    allDates.push(getLocalDateString(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }

  // 주 단위로 묶어 1~7일 랜덤 선택
  const selectedDates: string[] = [];
  for (let i = 0; i < allDates.length; i += 7) {
    const week = allDates.slice(i, i + 7);
    const count = randInt(1, 7);
    const shuffled = [...week].sort(() => Math.random() - 0.5);
    selectedDates.push(...shuffled.slice(0, Math.min(count, week.length)));
  }
  selectedDates.sort();

  // 기록 생성 (몸무게 트렌드: 완만하게 감량 후 유지)
  let baseWeight = 78.0;
  const records: WeightRecord[] = selectedDates.map((date, idx) => {
    // 매 40개마다 기저 체중 살짝 이동 (전체적으로 감량 트렌드)
    if (idx % 40 === 0 && idx > 0) {
      baseWeight += rand(-0.6, 0.3);
      baseWeight = Math.max(65, Math.min(90, baseWeight));
    }
    const weight = Math.round((baseWeight + rand(-1.5, 1.5)) * 10) / 10;
    const clampedWeight = Math.max(60, Math.min(95, weight));

    const hasWaist = Math.random() < 0.65;
    const hasMuscleMass = Math.random() < 0.6;
    const hasBodyFatPercent = Math.random() < 0.55;
    const hasBodyFatMass = Math.random() < 0.45;

    const bodyFatPercent = hasBodyFatPercent ? rand(14, 28) : undefined;
    const bodyFatMass = hasBodyFatMass
      ? Math.round(
          ((clampedWeight * (bodyFatPercent ?? rand(14, 28))) / 100) * 10
        ) / 10
      : undefined;

    return {
      id: date,
      date,
      weight: clampedWeight,
      waist: hasWaist ? rand(78, 88) : undefined,
      muscleMass: hasMuscleMass ? rand(28, 38) : undefined,
      bodyFatPercent,
      bodyFatMass,
      exercised: Math.random() < 0.4,
      drank: Math.random() < 0.25,
    };
  });

  await saveRecords(records);

  // 챌린지 히스토리 10개 생성 (6 성공 + 4 실패)
  const challengeHistory: ChallengeHistory[] = [];
  const outcomes = [
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
  ];
  // 셔플
  for (let i = outcomes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
  }

  for (let i = 0; i < 10; i++) {
    const monthsAgo = 3 + i * 3; // 대략 3개월 간격
    const cStart = new Date(today);
    cStart.setMonth(cStart.getMonth() - monthsAgo);
    const cEnd = new Date(cStart);
    const durationDays = randInt(14, 90);
    cEnd.setDate(cEnd.getDate() + durationDays);

    const startW = rand(70, 82);
    const isSuccess = outcomes[i];
    const targetW = Math.round((startW + rand(-5, -1)) * 10) / 10;
    const endW = isSuccess
      ? Math.round((targetW + rand(-1, 0.5)) * 10) / 10
      : Math.round((startW + rand(-0.5, 2)) * 10) / 10;

    const startMM = Math.random() < 0.5 ? rand(29, 35) : undefined;
    const targetMM = startMM
      ? Math.round((startMM + rand(0.5, 2)) * 10) / 10
      : undefined;
    const endMM = startMM
      ? isSuccess
        ? Math.round((targetMM! + rand(-0.5, 0.5)) * 10) / 10
        : Math.round((startMM + rand(-0.5, 0.5)) * 10) / 10
      : undefined;

    const startBF = Math.random() < 0.5 ? rand(18, 28) : undefined;
    const targetBF = startBF
      ? Math.round((startBF + rand(-5, -1)) * 10) / 10
      : undefined;
    const endBF = startBF
      ? isSuccess
        ? Math.round((targetBF! + rand(-1, 1)) * 10) / 10
        : Math.round((startBF + rand(-0.5, 1)) * 10) / 10
      : undefined;

    // 진행률 계산
    let progressSum = 0;
    let progressCount = 0;
    if (targetW !== startW) {
      progressSum += Math.min(
        100,
        Math.max(0, ((startW - endW) / (startW - targetW)) * 100)
      );
      progressCount++;
    }
    if (startMM && targetMM && endMM && targetMM !== startMM) {
      progressSum += Math.min(
        100,
        Math.max(0, ((endMM - startMM) / (targetMM - startMM)) * 100)
      );
      progressCount++;
    }
    if (startBF && targetBF && endBF && targetBF !== startBF) {
      progressSum += Math.min(
        100,
        Math.max(0, ((startBF - endBF) / (startBF - targetBF)) * 100)
      );
      progressCount++;
    }
    const overallProgress =
      progressCount > 0 ? Math.round(progressSum / progressCount) : null;

    const challenge: Challenge = {
      id: `dummy_challenge_${i}`,
      startWeight: startW,
      targetWeight: targetW,
      startMuscleMass: startMM,
      targetMuscleMass: targetMM,
      startBodyFatPercent: startBF,
      targetBodyFatPercent: targetBF,
      startDate: getLocalDateString(cStart),
      endDate: getLocalDateString(cEnd),
      createdAt: cStart.toISOString(),
    };

    challengeHistory.push({
      id: `dummy_history_${i}`,
      challenge,
      endWeight: endW,
      endMuscleMass: endMM,
      endBodyFatPercent: endBF,
      overallProgress,
      completedAt: cEnd.toISOString(),
    });
  }

  // 날짜 내림차순 정렬 (최신 먼저)
  challengeHistory.sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  await saveChallengeHistory(challengeHistory);

  return records;
}

/* ───── 챌린지 저장/불러오기 ───── */

export async function loadChallenge(): Promise<Challenge | null> {
  try {
    const data = await AsyncStorage.getItem(CHALLENGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as Challenge;
  } catch {
    return null;
  }
}

export async function saveChallenge(challenge: Challenge): Promise<void> {
  await AsyncStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
}

export async function deleteChallenge(): Promise<void> {
  await AsyncStorage.removeItem(CHALLENGE_KEY);
}

/* ───── 챌린지 히스토리 ───── */

export async function loadChallengeHistory(): Promise<ChallengeHistory[]> {
  try {
    const data = await AsyncStorage.getItem(CHALLENGE_HISTORY_KEY);
    if (!data) return [];
    return JSON.parse(data) as ChallengeHistory[];
  } catch {
    return [];
  }
}

export async function saveChallengeHistory(
  history: ChallengeHistory[]
): Promise<void> {
  await AsyncStorage.setItem(CHALLENGE_HISTORY_KEY, JSON.stringify(history));
}

export async function addChallengeToHistory(
  entry: ChallengeHistory
): Promise<ChallengeHistory[]> {
  const history = await loadChallengeHistory();
  history.unshift(entry);
  await saveChallengeHistory(history);
  return history;
}

/* ───── 사용자 설정 ───── */

export async function loadUserSettings(): Promise<UserSettings> {
  try {
    const data = await AsyncStorage.getItem(USER_SETTINGS_KEY);
    if (!data) return {};
    return JSON.parse(data) as UserSettings;
  } catch {
    return {};
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  await AsyncStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
}
