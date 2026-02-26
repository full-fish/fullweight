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
                '당신은 음식 영양소 분석 및 시각적 분량 추정 전문가입니다. 제공된 사진을 정밀하게 분석하여 반드시 지정된 JSON 형식으로만 응답하세요. 분석 과정에 대한 설명이나 인사말 등 다른 텍스트는 절대로 포함하지 마세요.\n\n출력 형식:\n{"description":"음식 이름","kcal":숫자,"carb":숫자,"protein":숫자,"fat":숫자}\n\n작성 규칙:\n- description: 반드시 한국어로 작성하세요. 한국 음식은 표준 명칭(예: 제육덮밥)을 사용하고, 외국 음식도 국내 통용 명칭을 사용하세요.\n- kcal/carb/protein/fat: 모든 수치는 정수 또는 소수점 첫째 자리까지의 숫자로만 입력하세요. 단위(g, kcal)는 생략합니다.\n- 영양소 정합성: 계산된 칼로리는 가급적 4×(탄수화물+단백질)+9×지방의 합계와 논리적으로 일치해야 합니다.\n\n분석 단계 및 우선순위:\n1. [영양성분표 확인] 사진 내에 영양성분표가 있다면 해당 수치를 최우선으로 채택합니다. 표기된 단위(예: 100g당)와 실제 사진상의 총량을 대조하여 전체 섭취량을 계산하세요.\n2. [제품·브랜드 식별] 제품명이나 브랜드 로고가 보일 경우, 해당 제품의 공식 DB 정보를 바탕으로 영양소를 산출하세요.\n3. [시각적 분량 추정] 포장지가 없는 경우 접시 크기, 함께 놓인 수저, 주변 사물과의 비율을 통해 음식의 무게(g) 또는 부피를 추정하세요. 1인분을 기본으로 하되 사진상에 나타난 실제 양을 반영합니다.\n\n판단 기준 데이터:\n- 탄수화물 위주(밥, 면, 빵): 100g당 약 130~250kcal (조리 방식에 따라 차등)\n- 단백질 위주(육류, 생선): 100g당 약 200~350kcal\n- 지방/기름진 음식(튀김, 중식): 100g당 약 400kcal 이상\n- 채소류: 100g당 약 20~50kcal\n\n예외 처리:\n사진이 너무 흐리거나 음식을 식별할 수 없는 경우, 가장 유사한 일반 음식의 평균값을 적용하고 description에 추정된 음식명을 적으세요.',
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
