import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

/* ────────────────────────────────────────────
   상수
   ──────────────────────────────────────────── */

// Google Cloud Console에서 발급받은 OAuth 2.0 클라이언트 ID (Web type)
// TODO: 실제 앱 출시 시 본인의 Client ID로 교체
const GOOGLE_CLIENT_ID =
  "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // 앱이 만든 파일만 접근
];

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_NAME = "fullweight";
const MAX_BACKUPS = 5;
const PHOTO_DIR = `${LegacyFileSystem.documentDirectory}photos/`;

// AsyncStorage keys
const KEY_ACCESS_TOKEN = "google_access_token";
const KEY_REFRESH_TOKEN = "google_refresh_token";
const KEY_TOKEN_EXPIRY = "google_token_expiry";
const KEY_USER_EMAIL = "google_user_email";
const KEY_LAST_BACKUP = "last_backup_timestamp";

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

/* ────────────────────────────────────────────
   인증
   ──────────────────────────────────────────── */

export function useGoogleAuth() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "fullweight" });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    discovery
  );

  return { request, response, promptAsync, redirectUri };
}

/** 코드 → 토큰 교환 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ accessToken: string; email: string }> {
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_CLIENT_ID,
      code,
      redirectUri,
      extraParams: { code_verifier: codeVerifier },
    },
    discovery
  );

  await AsyncStorage.setItem(KEY_ACCESS_TOKEN, tokenResult.accessToken);
  if (tokenResult.refreshToken) {
    await AsyncStorage.setItem(KEY_REFRESH_TOKEN, tokenResult.refreshToken);
  }
  const expiry = Date.now() + (tokenResult.expiresIn ?? 3600) * 1000;
  await AsyncStorage.setItem(KEY_TOKEN_EXPIRY, String(expiry));

  // 유저 이메일 가져오기
  const userInfo = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
  );
  const user = await userInfo.json();
  const email = user.email ?? "";
  await AsyncStorage.setItem(KEY_USER_EMAIL, email);

  return { accessToken: tokenResult.accessToken, email };
}

/** 유효한 Access Token 획득 (만료 시 자동 리프레시) */
export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = await AsyncStorage.getItem(KEY_ACCESS_TOKEN);
  const refreshToken = await AsyncStorage.getItem(KEY_REFRESH_TOKEN);
  const expiryStr = await AsyncStorage.getItem(KEY_TOKEN_EXPIRY);

  if (!accessToken) return null;

  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
  // 만료 5분 전에 리프레시
  if (Date.now() < expiry - 300_000) return accessToken;

  if (!refreshToken) return null;

  try {
    const tokenResult = await AuthSession.refreshAsync(
      { clientId: GOOGLE_CLIENT_ID, refreshToken },
      discovery
    );
    await AsyncStorage.setItem(KEY_ACCESS_TOKEN, tokenResult.accessToken);
    const newExpiry = Date.now() + (tokenResult.expiresIn ?? 3600) * 1000;
    await AsyncStorage.setItem(KEY_TOKEN_EXPIRY, String(newExpiry));
    return tokenResult.accessToken;
  } catch {
    // 리프레시 실패 → 로그아웃 처리
    await signOut();
    return null;
  }
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEY_ACCESS_TOKEN,
    KEY_REFRESH_TOKEN,
    KEY_TOKEN_EXPIRY,
    KEY_USER_EMAIL,
  ]);
}

/** 저장된 이메일 반환 */
export async function getSignedInEmail(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_USER_EMAIL);
}

/** 로그인 상태 확인 */
export async function isSignedIn(): Promise<boolean> {
  const token = await AsyncStorage.getItem(KEY_ACCESS_TOKEN);
  return !!token;
}

/* ────────────────────────────────────────────
   Google Drive 헬퍼
   ──────────────────────────────────────────── */

type DriveFile = {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
};

/** fullweight 폴더 ID 가져오기 (없으면 생성) */
async function getOrCreateFolder(token: string): Promise<string> {
  // 기존 폴더 검색
  const q = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 폴더 생성
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"],
    }),
  });
  const created = await createRes.json();
  return created.id;
}

/** 폴더 내 백업 파일 목록 (최신순) */
async function listBackups(
  token: string,
  folderId: string
): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.files ?? [];
}

/** 파일 삭제 */
async function deleteDriveFile(
  token: string,
  fileId: string
): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** 파일 업로드 (multipart) */
async function uploadFile(
  token: string,
  folderId: string,
  fileName: string,
  contentBase64: string,
  mimeType: string
): Promise<DriveFile> {
  const boundary = "fullweight_boundary_" + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${contentBase64}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,createdTime,size`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  return res.json();
}

/** 파일 다운로드 (base64) */
async function downloadFile(
  token: string,
  fileId: string
): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // data:...;base64, 부분 제거
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ────────────────────────────────────────────
   백업 / 복원 (JSON + 이미지 묶어서)
   ──────────────────────────────────────────── */

type BackupPayload = {
  version: number;
  createdAt: string;
  records: string; // JSON stringified
  challenge: string | null;
  challengeHistory: string | null;
  userSettings: string | null;
  images: { name: string; base64: string }[];
};

/** 모든 로컬 데이터를 백업 파일 하나로 Google Drive에 업로드 */
export async function performBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getValidAccessToken();
    if (!token) return { success: false, error: "로그인이 필요합니다" };

    // 1. 로컬 데이터 수집
    const records = await AsyncStorage.getItem("weight_records_v1");
    const challenge = await AsyncStorage.getItem("weight_challenge_v1");
    const challengeHistory = await AsyncStorage.getItem(
      "weight_challenge_history_v1"
    );
    const userSettings = await AsyncStorage.getItem("user_settings_v1");

    // 2. 이미지 수집
    const images: { name: string; base64: string }[] = [];
    try {
      const dirInfo = await LegacyFileSystem.getInfoAsync(PHOTO_DIR);
      if (dirInfo.exists) {
        const files = await LegacyFileSystem.readDirectoryAsync(PHOTO_DIR);
        for (const file of files) {
          const filePath = PHOTO_DIR + file;
          const base64 = await LegacyFileSystem.readAsStringAsync(filePath, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
          images.push({ name: file, base64 });
        }
      }
    } catch {
      // 이미지 폴더가 없으면 무시
    }

    // 3. 백업 데이터 구성
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      records: records ?? "[]",
      challenge,
      challengeHistory,
      userSettings,
      images,
    };

    const jsonStr = JSON.stringify(payload);
    // base64로 인코딩
    const base64Content = btoa(
      encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );

    // 4. 폴더 확보 + 업로드
    const folderId = await getOrCreateFolder(token);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const fileName = `fullweight_backup_${dateStr}.json`;

    await uploadFile(token, folderId, fileName, base64Content, "application/json");

    // 5. 오래된 백업 삭제 (5개 초과)
    const backups = await listBackups(token, folderId);
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        await deleteDriveFile(token, file.id);
      }
    }

    // 6. 마지막 백업 시간 저장
    await AsyncStorage.setItem(KEY_LAST_BACKUP, String(Date.now()));

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "백업 실패" };
  }
}

/** Google Drive에서 백업 파일 목록 가져오기 */
export async function getBackupList(): Promise<{
  backups: DriveFile[];
  error?: string;
}> {
  try {
    const token = await getValidAccessToken();
    if (!token) return { backups: [], error: "로그인이 필요합니다" };

    const folderId = await getOrCreateFolder(token);
    const backups = await listBackups(token, folderId);
    return { backups };
  } catch (e: any) {
    return { backups: [], error: e?.message ?? "목록 조회 실패" };
  }
}

/** 특정 백업 파일에서 데이터 복원 */
export async function performRestore(
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getValidAccessToken();
    if (!token) return { success: false, error: "로그인이 필요합니다" };

    // 1. 파일 다운로드
    const base64Content = await downloadFile(token, fileId);

    // 2. 디코딩
    const jsonStr = decodeURIComponent(
      atob(base64Content)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload: BackupPayload = JSON.parse(jsonStr);

    // 3. 로컬 데이터 복원
    await AsyncStorage.setItem("weight_records_v1", payload.records);
    if (payload.challenge) {
      await AsyncStorage.setItem("weight_challenge_v1", payload.challenge);
    } else {
      await AsyncStorage.removeItem("weight_challenge_v1");
    }
    if (payload.challengeHistory) {
      await AsyncStorage.setItem(
        "weight_challenge_history_v1",
        payload.challengeHistory
      );
    } else {
      await AsyncStorage.removeItem("weight_challenge_history_v1");
    }
    if (payload.userSettings) {
      await AsyncStorage.setItem("user_settings_v1", payload.userSettings);
    }

    // 4. 이미지 복원
    if (payload.images && payload.images.length > 0) {
      // photos 디렉토리 확보
      const dirInfo = await LegacyFileSystem.getInfoAsync(PHOTO_DIR);
      if (!dirInfo.exists) {
        await LegacyFileSystem.makeDirectoryAsync(PHOTO_DIR, {
          intermediates: true,
        });
      }

      for (const img of payload.images) {
        const destPath = PHOTO_DIR + img.name;
        await LegacyFileSystem.writeAsStringAsync(destPath, img.base64, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });
      }
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "복원 실패" };
  }
}

/** 마지막 백업 시간 가져오기 */
export async function getLastBackupTime(): Promise<number | null> {
  const ts = await AsyncStorage.getItem(KEY_LAST_BACKUP);
  return ts ? parseInt(ts, 10) : null;
}

/** 자동 백업 필요 여부 확인 (24시간 경과) */
export async function shouldAutoBackup(): Promise<boolean> {
  const signedIn = await isSignedIn();
  if (!signedIn) return false;

  const lastBackup = await getLastBackupTime();
  if (!lastBackup) return true; // 한번도 백업 안 했으면

  const elapsed = Date.now() - lastBackup;
  return elapsed > 24 * 60 * 60 * 1000; // 24시간
}
