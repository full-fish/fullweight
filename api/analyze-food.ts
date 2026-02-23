import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/analyze-food
 * Body: { base64: string, model?: string }   (JPEG base64, no data:... prefix)
 * Response: { description, kcal, carb, protein, fat }
 *
 * Deploy to Vercel:
 *   1) vercel 가입 후 이 레포 연결
 *   2) Settings > Environment Variables 에서
 *      OPENAI_API_KEY = sk-... 추가
 *   3) vercel deploy
 *
 * 비용 참고:
 *   gpt-4o-mini + high: 이미지 1장 ≈ $0.01~0.02
 *   gpt-4o + high:      이미지 1장 ≈ $0.04~0.08
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." });
  }

  const { base64, model } = req.body ?? {};
  if (!base64 || typeof base64 !== "string") {
    return res.status(400).json({ error: "base64 필드가 필요합니다." });
  }

  const useModel = model === "gpt-4o" ? "gpt-4o" : "gpt-4o-mini";

  try {
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: useModel,
          messages: [
            {
              role: "system",
              content:
                '당신은 음식 영양소 분석 전문가입니다. 음식 사진을 보고 다음 JSON만 출력하세요. 다른 말은 하지 마세요.\n{"description":"음식 이름","kcal":숫자,"carb":숫자,"protein":숫자,"fat":숫자}\n- kcal: 칼로리, carb: 탄수화물(g), protein: 단백질(g), fat: 지방(g)\n\n분석 규칙:\n1. 먼저 음식 종류를 파악하세요.\n2. 그릇, 접시, 손 등 대비 실제 양(인분 수, 조각 수, 무게)을 추정하세요.\n3. 일반적인 성인 1인분 기준으로 칼로리를 계산하되, 사진에 보이는 양이 1인분보다 많으면 실제 보이는 양으로 계산하세요.\n4. 예: 피자 한 판(8조각) ≈ 1800-2200kcal, 피자 1조각 ≈ 250-300kcal, 치킨 한 마리 ≈ 250-350kcal, 밥 한 공기 ≈ 300kcal',
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64}`,
                    detail: "high",
                  },
                },
                { type: "text", text: "이 음식의 영양소를 분석해주세요." },
              ],
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      }
    );

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return res.status(502).json({ error: `OpenAI 오류: ${errText}` });
    }

    const data = await openaiRes.json();
    const content: string = data.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonStr = content
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr);

    return res.status(200).json({
      description: parsed.description || "음식",
      kcal: Math.round(Number(parsed.kcal) || 0),
      carb: Math.round(Number(parsed.carb) || 0),
      protein: Math.round(Number(parsed.protein) || 0),
      fat: Math.round(Number(parsed.fat) || 0),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "알 수 없는 오류" });
  }
}
