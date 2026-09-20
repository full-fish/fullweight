import {
  Challenge,
  ChallengeHistory,
  FavoriteFood,
  MealEntry,
  MealType,
  WeightRecord,
} from "@/types";
import {
  getLocalDateString,
  saveChallengeHistory,
  saveFavoriteFoods,
  saveMeals,
  saveRecords,
} from "@/utils/storage";


/**
 * 약 3년치 더미 데이터 생성 및 저장
 * - 일주일마다 1~7일 랜덤 기록
 * - 몸무게: 78kg 근방에서 완만한 변화 + 노이즈 (15% 확률로 체중 없이 토글만)
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

  // 기록 생성 (몸무게 트렌드: 완만하게 감량 후 유지, 15% 확률로 체중 없이 토글만)
  let baseWeight = 78.0;
  const records: WeightRecord[] = selectedDates.map((date, idx) => {
    // 매 40개마다 기저 체중 살짝 이동 (전체적으로 감량 트렌드)
    if (idx % 40 === 0 && idx > 0) {
      baseWeight += rand(-0.6, 0.3);
      baseWeight = Math.max(65, Math.min(90, baseWeight));
    }

    // 15% 확률로 체중 없이 토글만 기록
    const skipWeight = Math.random() < 0.15;

    const weight = skipWeight
      ? undefined
      : Math.max(
          60,
          Math.min(95, Math.round((baseWeight + rand(-1.5, 1.5)) * 10) / 10)
        );

    const hasWaist = Math.random() < 0.65;
    const hasMuscleMass = !skipWeight && Math.random() < 0.6;
    const hasBodyFatPercent = !skipWeight && Math.random() < 0.55;
    const hasBodyFatMass = !skipWeight && Math.random() < 0.45;

    const bodyFatPercent = hasBodyFatPercent ? rand(14, 28) : undefined;
    const bodyFatMass = hasBodyFatMass
      ? Math.round(
          (((weight ?? 75) * (bodyFatPercent ?? rand(14, 28))) / 100) * 10
        ) / 10
      : undefined;

    return {
      id: date,
      date,
      weight,
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

  // ── 더미 식사 기록 생성 ──
  const DUMMY_MEALS: {
    name: string;
    mealType: MealType;
    kcal: number;
    carb: number;
    protein: number;
    fat: number;
  }[] = [
    // 아침
    {
      name: "계란 프라이 2개, 식빵 1장",
      mealType: "breakfast",
      kcal: 350,
      carb: 30,
      protein: 18,
      fat: 18,
    },
    {
      name: "바나나 1개, 우유 한 잔",
      mealType: "breakfast",
      kcal: 220,
      carb: 35,
      protein: 10,
      fat: 5,
    },
    {
      name: "오트밀 + 블루베리",
      mealType: "breakfast",
      kcal: 280,
      carb: 45,
      protein: 8,
      fat: 6,
    },
    {
      name: "김치찌개, 밥 반공기",
      mealType: "breakfast",
      kcal: 380,
      carb: 42,
      protein: 15,
      fat: 14,
    },
    {
      name: "그릭요거트 + 그래놀라",
      mealType: "breakfast",
      kcal: 310,
      carb: 38,
      protein: 15,
      fat: 10,
    },
    {
      name: "토스트 + 아보카도",
      mealType: "breakfast",
      kcal: 340,
      carb: 28,
      protein: 8,
      fat: 22,
    },
    {
      name: "삶은 계란 3개",
      mealType: "breakfast",
      kcal: 240,
      carb: 2,
      protein: 21,
      fat: 16,
    },
    // 점심
    {
      name: "닭가슴살 도시락",
      mealType: "lunch",
      kcal: 520,
      carb: 55,
      protein: 42,
      fat: 12,
    },
    {
      name: "김치볶음밥 + 계란",
      mealType: "lunch",
      kcal: 580,
      carb: 72,
      protein: 18,
      fat: 20,
    },
    {
      name: "제육볶음 정식",
      mealType: "lunch",
      kcal: 650,
      carb: 65,
      protein: 30,
      fat: 25,
    },
    {
      name: "순두부찌개 + 밥",
      mealType: "lunch",
      kcal: 480,
      carb: 52,
      protein: 22,
      fat: 18,
    },
    {
      name: "비빔밥",
      mealType: "lunch",
      kcal: 550,
      carb: 68,
      protein: 20,
      fat: 18,
    },
    {
      name: "샐러드 + 닭가슴살",
      mealType: "lunch",
      kcal: 380,
      carb: 15,
      protein: 38,
      fat: 16,
    },
    {
      name: "된장찌개 + 생선구이 + 밥",
      mealType: "lunch",
      kcal: 520,
      carb: 58,
      protein: 28,
      fat: 16,
    },
    {
      name: "돈까스 정식",
      mealType: "lunch",
      kcal: 720,
      carb: 65,
      protein: 28,
      fat: 35,
    },
    {
      name: "냉면",
      mealType: "lunch",
      kcal: 450,
      carb: 70,
      protein: 15,
      fat: 10,
    },
    // 저녁
    {
      name: "삼겹살 200g + 쌈",
      mealType: "dinner",
      kcal: 680,
      carb: 12,
      protein: 32,
      fat: 55,
    },
    {
      name: "연어 스테이크 + 샐러드",
      mealType: "dinner",
      kcal: 520,
      carb: 10,
      protein: 40,
      fat: 32,
    },
    {
      name: "치킨 반마리",
      mealType: "dinner",
      kcal: 750,
      carb: 25,
      protein: 45,
      fat: 48,
    },
    {
      name: "된장찌개 + 밥",
      mealType: "dinner",
      kcal: 450,
      carb: 55,
      protein: 18,
      fat: 14,
    },
    {
      name: "불고기 + 밥",
      mealType: "dinner",
      kcal: 580,
      carb: 62,
      protein: 28,
      fat: 20,
    },
    {
      name: "두부 스테이크 + 현미밥",
      mealType: "dinner",
      kcal: 420,
      carb: 48,
      protein: 22,
      fat: 14,
    },
    {
      name: "갈비탕 + 밥",
      mealType: "dinner",
      kcal: 620,
      carb: 55,
      protein: 30,
      fat: 28,
    },
    {
      name: "파스타 (토마토 소스)",
      mealType: "dinner",
      kcal: 550,
      carb: 68,
      protein: 18,
      fat: 18,
    },
    // 간식
    {
      name: "프로틴 쉐이크",
      mealType: "snack",
      kcal: 180,
      carb: 8,
      protein: 30,
      fat: 3,
    },
    {
      name: "아몬드 한 줌",
      mealType: "snack",
      kcal: 160,
      carb: 6,
      protein: 6,
      fat: 14,
    },
    {
      name: "고구마 1개",
      mealType: "snack",
      kcal: 130,
      carb: 30,
      protein: 2,
      fat: 0,
    },
    {
      name: "사과 1개",
      mealType: "snack",
      kcal: 95,
      carb: 25,
      protein: 0,
      fat: 0,
    },
    {
      name: "초코바",
      mealType: "snack",
      kcal: 250,
      carb: 35,
      protein: 4,
      fat: 12,
    },
    {
      name: "커피 (라떼)",
      mealType: "snack",
      kcal: 150,
      carb: 15,
      protein: 8,
      fat: 6,
    },
    {
      name: "떡볶이",
      mealType: "snack",
      kcal: 380,
      carb: 62,
      protein: 8,
      fat: 10,
    },
  ];

  type MealTypeKey = "breakfast" | "lunch" | "dinner" | "snack";
  const mealsByType: Record<MealTypeKey, typeof DUMMY_MEALS> = {
    breakfast: DUMMY_MEALS.filter((m) => m.mealType === "breakfast"),
    lunch: DUMMY_MEALS.filter((m) => m.mealType === "lunch"),
    dinner: DUMMY_MEALS.filter((m) => m.mealType === "dinner"),
    snack: DUMMY_MEALS.filter((m) => m.mealType === "snack"),
  };

  const meals: MealEntry[] = [];
  for (const date of selectedDates) {
    // 70% 확률로 해당 날짜에 식사 기록 생성
    if (Math.random() > 0.7) continue;

    // 아침(60%), 점심(85%), 저녁(80%), 간식(40%) 확률
    const mealProbs: { type: MealTypeKey; prob: number }[] = [
      { type: "breakfast", prob: 0.6 },
      { type: "lunch", prob: 0.85 },
      { type: "dinner", prob: 0.8 },
      { type: "snack", prob: 0.4 },
    ];

    for (const { type, prob } of mealProbs) {
      if (Math.random() > prob) continue;
      const pool = mealsByType[type];
      const picked = pool[Math.floor(Math.random() * pool.length)];
      // ±15% 변동
      const vary = () => Math.round(picked.kcal * (0.85 + Math.random() * 0.3));
      const varyG = (v: number) => Math.round(v * (0.85 + Math.random() * 0.3));

      meals.push({
        id: `dummy_meal_${date}_${type}`,
        date,
        mealType: type,
        description: picked.name,
        kcal: vary(),
        carb: varyG(picked.carb),
        protein: varyG(picked.protein),
        fat: varyG(picked.fat),
        createdAt: new Date(
          `${date}T${
            type === "breakfast"
              ? "08"
              : type === "lunch"
                ? "12"
                : type === "dinner"
                  ? "19"
                  : "15"
          }:00:00`
        ).toISOString(),
      });
    }
  }

  await saveMeals(meals);

  const favoriteFoods: FavoriteFood[] = [
    {
      id: "dummy_favorite_01",
      name: "닭가슴살 샐러드",
      carb: 12,
      protein: 32,
      fat: 6,
      kcal: 270,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_02",
      name: "현미밥 한 공기",
      carb: 45,
      protein: 7,
      fat: 2,
      kcal: 210,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_03",
      name: "계란 2개",
      carb: 1,
      protein: 12,
      fat: 10,
      kcal: 140,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_04",
      name: "그릭요거트",
      carb: 14,
      protein: 18,
      fat: 4,
      kcal: 180,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_05",
      name: "바나나",
      carb: 27,
      protein: 1,
      fat: 0,
      kcal: 105,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_06",
      name: "아보카도",
      carb: 12,
      protein: 2,
      fat: 15,
      kcal: 160,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_07",
      name: "연어 스테이크",
      carb: 0,
      protein: 23,
      fat: 18,
      kcal: 260,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_08",
      name: "두부 도시락",
      carb: 30,
      protein: 20,
      fat: 15,
      kcal: 300,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_09",
      name: "샐러드 파스타",
      carb: 50,
      protein: 15,
      fat: 10,
      kcal: 360,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_10",
      name: "닭가슴살 볶음밥",
      carb: 38,
      protein: 28,
      fat: 8,
      kcal: 330,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_11",
      name: "오트밀",
      carb: 35,
      protein: 8,
      fat: 5,
      kcal: 220,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_12",
      name: "아몬드",
      carb: 6,
      protein: 6,
      fat: 14,
      kcal: 170,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_13",
      name: "쌀국수",
      carb: 55,
      protein: 14,
      fat: 7,
      kcal: 390,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_14",
      name: "치킨 샐러드",
      carb: 18,
      protein: 35,
      fat: 12,
      kcal: 320,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_15",
      name: "토스트",
      carb: 26,
      protein: 7,
      fat: 4,
      kcal: 170,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_16",
      name: "단백질 쉐이크",
      carb: 10,
      protein: 25,
      fat: 2,
      kcal: 180,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_17",
      name: "고구마",
      carb: 32,
      protein: 2,
      fat: 0,
      kcal: 140,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_18",
      name: "김치볶음밥",
      carb: 60,
      protein: 16,
      fat: 18,
      kcal: 500,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_19",
      name: "두부 스테이크",
      carb: 12,
      protein: 22,
      fat: 14,
      kcal: 260,
      createdAt: new Date().toISOString(),
    },
    {
      id: "dummy_favorite_20",
      name: "삶은 고구마 + 삶은 계란",
      carb: 28,
      protein: 14,
      fat: 7,
      kcal: 280,
      createdAt: new Date().toISOString(),
    },
  ];
  await saveFavoriteFoods(favoriteFoods);

  return records;
}
