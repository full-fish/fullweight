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
                '당신은 음식 영양소 분석 및 시각적 분량 추정 전문가입니다. 음식 사진을 보고 다음 JSON만 출력하세요. 다른 말은 하지 마세요.\n{"description":"음식 이름","kcal":숫자,"carb":숫자,"protein":숫자,"fat":숫자}\n\n분석 및 계산 규칙:\n1. 패키지 제품 분석: 사진에 캔, 봉지, 병 등 완제품 용기가 통째로 보인다면 1회 제공량이 아닌 해당 용기 전체 용량을 기준으로 계산하세요.\n2. 규격 판별: 제품명과 브랜드가 식별되면 해당 제품의 표준 규격(예: 프링글스 소형 캔 53g, 대형 캔 110g)을 검색하거나 시각적으로 판별하여 정확한 총량을 추정하세요.\n3. 영양소 정합성: 아래 수식을 바탕으로 칼로리와 영양소의 합계가 논리적으로 일치해야 합니다.\n\n수식 참고:\n$$kcal = 4 \times (carb + protein) + 9 \times fat$$\n\n분석 우선순위:\n1. [최우선] 사진에 영양성분표가 직접 보이면 그 수치를 그대로 사용하세요.\n2. [차선] 제품명/브랜드명이 보이면 해당 제품 전체(Total contents)의 공식 정보를 활용하세요.\n3. [기본] 일반 음식은 주변 사물과 크기를 비교하여 무게(g)를 추정해 계산하세요.',
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
