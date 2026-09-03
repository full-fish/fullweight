import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/version
 * 앱이 시작될 때 이 값과 현재 versionCode를 비교해 강제 업데이트 여부를 결정.
 * 새 버전 배포 후 minVersionCode를 올리면 구버전 사용자에게 업데이트 안내가 뜸.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ minVersionCode: 17 });
}
