import type { AiModelOption } from "@/types";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export type FoodAnalysisResult = {
  description: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
};

/**
 * ⚠️ Vercel 배포 후 본인 URL로 교체하세요
 * e.g. "https://fullweight.vercel.app/api/analyze-food"
 */
const ANALYZE_API_URL = "https://fullweight.vercel.app/api/analyze-food";

/** AI 분석용으로 이미지를 적절한 크기로 리사이즈 (최대 1024px) */
async function resizeForAI(photoUri: string): Promise<string> {
  const manipulated = await manipulateAsync(
    photoUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.8, format: SaveFormat.JPEG }
  );
  return manipulated.uri;
}

/**
 * 음식 사진을 백엔드 프록시를 통해 AI 분석
 * - API 키는 Vercel 서버에만 존재 → 앱 번들에 노출 없음
 * - 원본 사진은 자동 리사이즈 후 전송 (Vercel body limit 대응)
 */
export async function analyzeFood(
  photoUri: string,
  model: AiModelOption = "gpt-4o-mini"
): Promise<FoodAnalysisResult> {
  // AI 분석용 이미지 리사이즈
  const resizedUri = await resizeForAI(photoUri);

  const base64 = await LegacyFileSystem.readAsStringAsync(resizedUri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });

  // 리사이즈된 임시 파일 정리
  if (resizedUri !== photoUri) {
    LegacyFileSystem.deleteAsync(resizedUri, { idempotent: true }).catch(
      () => {}
    );
  }

  const res = await fetch(ANALYZE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, model }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `서버 오류 (${res.status})`);
  }

  return res.json();
}
