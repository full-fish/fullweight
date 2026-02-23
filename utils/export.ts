import { MEAL_LABELS, MealEntry, WeightRecord } from "@/types";
import {
  loadChallenge,
  loadChallengeHistory,
  loadMeals,
  loadRecords,
  loadUserSettings,
} from "@/utils/storage";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";

export type ExportFormat = "json" | "csv" | "zip";

/* ───── 데이터 수집 ───── */

async function collectAllData() {
  const [records, meals, challenge, challengeHistory, settings] =
    await Promise.all([
      loadRecords(),
      loadMeals(),
      loadChallenge(),
      loadChallengeHistory(),
      loadUserSettings(),
    ]);
  return { records, meals, challenge, challengeHistory, settings };
}

/* ───── JSON 내보내기 ───── */

async function exportJSON(): Promise<string> {
  const data = await collectAllData();

  const exportData: Record<string, unknown> = {
    exportDate: new Date().toISOString(),
    version: 1,
    records: data.records,
    meals: data.meals,
    challenge: data.challenge,
    challengeHistory: data.challengeHistory,
    settings: data.settings,
  };

  const json = JSON.stringify(exportData, null, 2);
  const fileName = `fullweight_export_${formatDateForFile()}.json`;
  const filePath = `${LegacyFileSystem.cacheDirectory}${fileName}`;
  await LegacyFileSystem.writeAsStringAsync(filePath, json);
  return filePath;
}

/* ───── CSV 내보내기 ───── */

function escapeCSV(val: string | number | boolean | undefined | null): string {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function recordsToCSV(records: WeightRecord[]): string {
  const headers = [
    "날짜",
    "몸무게(kg)",
    "허리둘레(cm)",
    "골격근량(kg)",
    "체지방률(%)",
    "체지방량(kg)",
    "운동",
    "음주",
  ];

  // 사용자 정의 수치/체크 키 수집
  const customNumKeys = new Set<string>();
  const customBoolKeys = new Set<string>();
  for (const r of records) {
    if (r.customValues)
      Object.keys(r.customValues).forEach((k) => customNumKeys.add(k));
    if (r.customBoolValues)
      Object.keys(r.customBoolValues).forEach((k) => customBoolKeys.add(k));
  }
  const cnKeys = [...customNumKeys];
  const cbKeys = [...customBoolKeys];
  const allHeaders = [...headers, ...cnKeys, ...cbKeys];

  const rows = records.map((r) => {
    const base = [
      escapeCSV(r.date),
      escapeCSV(r.weight),
      escapeCSV(r.waist),
      escapeCSV(r.muscleMass),
      escapeCSV(r.bodyFatPercent),
      escapeCSV(r.bodyFatMass),
      escapeCSV(r.exercised ? "O" : "X"),
      escapeCSV(r.drank ? "O" : "X"),
    ];
    for (const k of cnKeys) base.push(escapeCSV(r.customValues?.[k]));
    for (const k of cbKeys)
      base.push(escapeCSV(r.customBoolValues?.[k] ? "O" : "X"));
    return base.join(",");
  });

  return [allHeaders.map(escapeCSV).join(","), ...rows].join("\n");
}

function mealsToCSV(meals: MealEntry[]): string {
  const headers = [
    "날짜",
    "식사종류",
    "설명",
    "탄수화물(g)",
    "단백질(g)",
    "지방(g)",
    "칼로리(kcal)",
  ];

  const rows = meals.map((m) => {
    const base = [
      escapeCSV(m.date),
      escapeCSV(MEAL_LABELS[m.mealType] ?? m.mealType),
      escapeCSV(m.description),
      escapeCSV(m.carb),
      escapeCSV(m.protein),
      escapeCSV(m.fat),
      escapeCSV(m.kcal),
    ];
    return base.join(",");
  });

  return [headers.map(escapeCSV).join(","), ...rows].join("\n");
}

async function exportCSV(): Promise<string> {
  const data = await collectAllData();

  // BOM for Excel 호환
  const BOM = "\uFEFF";

  const recordCSV = BOM + recordsToCSV(data.records);
  const mealCSV = BOM + mealsToCSV(data.meals);

  // 두 개의 CSV를 ZIP으로 묶기
  const zip = new JSZip();
  zip.file("체중기록.csv", recordCSV);
  zip.file("식사기록.csv", mealCSV);

  const zipBase64 = await zip.generateAsync({ type: "base64" });
  const fileName = `fullweight_csv_${formatDateForFile()}.zip`;
  const filePath = `${LegacyFileSystem.cacheDirectory}${fileName}`;
  await LegacyFileSystem.writeAsStringAsync(filePath, zipBase64, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
  return filePath;
}

/* ───── ZIP 내보내기 (JSON + 사진) ───── */

async function exportZIP(includePhotos: boolean): Promise<string> {
  const data = await collectAllData();
  const zip = new JSZip();

  // JSON 데이터 (사진 경로는 상대경로로 변환)
  const photoMap: Record<string, string> = {};

  const processUri = (uri?: string): string | undefined => {
    if (!uri || !includePhotos) return undefined;
    const filename = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
    photoMap[uri] = `photos/${filename}`;
    return `photos/${filename}`;
  };

  const exportRecords = data.records.map((r) => ({
    ...r,
    photoUri: processUri(r.photoUri),
  }));

  const exportMeals = data.meals.map((m) => ({
    ...m,
    photoUri: processUri(m.photoUri),
  }));

  const exportData = {
    exportDate: new Date().toISOString(),
    version: 1,
    records: exportRecords,
    meals: exportMeals,
    challenge: data.challenge,
    challengeHistory: data.challengeHistory,
    settings: data.settings,
  };

  zip.file("data.json", JSON.stringify(exportData, null, 2));

  // CSV도 포함
  zip.file("체중기록.csv", "\uFEFF" + recordsToCSV(data.records));
  zip.file("식사기록.csv", "\uFEFF" + mealsToCSV(data.meals));

  // 사진 파일 추가
  if (includePhotos) {
    const photosFolder = zip.folder("photos");
    for (const [absUri, relPath] of Object.entries(photoMap)) {
      try {
        const info = await LegacyFileSystem.getInfoAsync(absUri);
        if (info.exists) {
          const base64 = await LegacyFileSystem.readAsStringAsync(absUri, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
          const filename = relPath.replace("photos/", "");
          photosFolder?.file(filename, base64, { base64: true });
        }
      } catch {
        // skip missing photo
      }
    }
  }

  const zipBase64 = await zip.generateAsync({ type: "base64" });
  const fileName = `fullweight_backup_${formatDateForFile()}.zip`;
  const filePath = `${LegacyFileSystem.cacheDirectory}${fileName}`;
  await LegacyFileSystem.writeAsStringAsync(filePath, zipBase64, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
  return filePath;
}

/* ───── 공통 유틸 ───── */

function formatDateForFile(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${h}${min}${sec}`;
}

/* ───── 메인 내보내기 함수 ───── */

/**
 * 데이터를 내보내고 공유 시트를 통해 저장 위치를 선택합니다.
 * - Android/iOS: 공유 시트 → "파일에 저장" 선택 가능
 * @returns 저장된 파일명
 */
export async function exportData(
  format: ExportFormat,
  includePhotos: boolean
): Promise<string> {
  let tempPath: string;

  switch (format) {
    case "json":
      tempPath = await exportJSON();
      break;
    case "csv":
      tempPath = await exportCSV();
      break;
    case "zip":
      tempPath = await exportZIP(includePhotos);
      break;
  }

  const fileName = tempPath.split("/").pop()!;

  const mimeType = format === "json" ? "application/json" : "application/zip";

  await Sharing.shareAsync(tempPath, {
    mimeType,
    dialogTitle: "내보내기 파일 저장",
  });

  // 임시 파일 정리
  await LegacyFileSystem.deleteAsync(tempPath, { idempotent: true });

  return fileName;
}

/** 내보내기 전 사진 수와 예상 용량을 계산 */
export async function estimatePhotoSize(): Promise<{
  count: number;
  sizeBytes: number;
}> {
  const [records, meals] = await Promise.all([loadRecords(), loadMeals()]);
  const uris = new Set<string>();

  for (const r of records) {
    if (r.photoUri) uris.add(r.photoUri);
  }
  for (const m of meals) {
    if (m.photoUri) uris.add(m.photoUri);
  }

  let totalSize = 0;
  for (const uri of uris) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(uri);
      if (info.exists && "size" in info && typeof info.size === "number") {
        totalSize += info.size;
      }
    } catch {
      // skip
    }
  }

  return { count: uris.size, sizeBytes: totalSize };
}
