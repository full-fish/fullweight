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

export type FoodSearchItem = FoodAnalysisResult & {
  brand?: string;
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

/**
 * Open Food Facts API로 음식명 검색 (무료, API 키 불필요)
 */
export async function searchFood(query: string): Promise<FoodSearchItem[]> {
  if (!query.trim()) return [];

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&lc=ko`;

  const res = await fetch(url, {
    headers: { "User-Agent": "fullweight-app/1.0" },
  });
  if (!res.ok) throw new Error(`검색 실패 (${res.status})`);

  const data = await res.json();
  const products: FoodSearchItem[] = [];

  for (const p of data.products ?? []) {
    const n = p.nutriments ?? {};
    const kcal = Math.round(
      n["energy-kcal_100g"] ?? (n["energy_100g"] ?? 0) / 4.184
    );
    const carb = Math.round(n["carbohydrates_100g"] ?? 0);
    const protein = Math.round(n["proteins_100g"] ?? 0);
    const fat = Math.round(n["fat_100g"] ?? 0);

    const name: string =
      p.product_name_ko || p.product_name || p.generic_name || "";
    if (!name) continue;

    products.push({
      description: name,
      brand: p.brands ?? undefined,
      kcal,
      carb,
      protein,
      fat,
    });
  }

  return products;
}
