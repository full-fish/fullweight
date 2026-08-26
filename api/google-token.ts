import type { VercelRequest, VercelResponse } from "@vercel/node";

// GOOGLE_CLIENT_SECRET은 Vercel 대시보드 Environment Variables에서만 설정
// (EXPO_PUBLIC_ 접두사 없이 서버 전용)
const CLIENT_ID =
  "400889107494-tvv0hbt10o2s7dgn4kb8r1nj6nsfjvh8.apps.googleusercontent.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const { grant_type, code, refresh_token } = req.body as {
    grant_type: string;
    code?: string;
    refresh_token?: string;
  };

  if (grant_type === "authorization_code" && !code) {
    return res.status(400).json({ error: "code is required" });
  }
  if (grant_type === "refresh_token" && !refresh_token) {
    return res.status(400).json({ error: "refresh_token is required" });
  }
  if (!["authorization_code", "refresh_token"].includes(grant_type)) {
    return res.status(400).json({ error: "unsupported grant_type" });
  }

  const params: Record<string, string> = {
    client_id: CLIENT_ID,
    client_secret: clientSecret,
    grant_type,
  };
  if (grant_type === "authorization_code" && code) params.code = code;
  if (grant_type === "refresh_token" && refresh_token)
    params.refresh_token = refresh_token;

  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const googleRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await googleRes.json();
  return res.status(googleRes.status).json(data);
}
