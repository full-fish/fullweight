import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LegacyFileSystem from "expo-file-system/legacy";
import JSZip from "jszip";
import { Platform } from "react-native";

const getNativeRequire = () => Function("return require")();

const resolveNativeModule = (pkg: string): any => {
  if (Platform.OS === "web") return null;

  try {
    const nativeRequire = getNativeRequire();
    return nativeRequire(pkg);
  } catch {
    return null;
  }
};

const GoogleSignin = resolveNativeModule(
  "@react-native-google-signin/google-signin"
);

/* ────────────────────────────────────────────
   상수
   ──────────────────────────────────────────── */

const GOOGLE_WEB_CLIENT_ID =
  "400889107494-tvv0hbt10o2s7dgn4kb8r1nj6nsfjvh8.apps.googleusercontent.com";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // 앱이 만든 파일만 접근
];

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_NAME = "fullweight";
const MAX_BACKUPS = 5;
const PHOTO_DIR = `${LegacyFileSystem.documentDirectory}photos/`;

// AsyncStorage keys
const KEY_USER_EMAIL = "google_user_email";
const KEY_LAST_BACKUP = "last_backup_timestamp";
const KEY_BACKUP_INTERVAL = "backup_interval_days"; // 자동 백업 주기 (일)
const DEFAULT_BACKUP_INTERVAL = 1; // 기본: 매일

// Google Sign-In 초기 설정 — 토큰은 라이브러리가 직접 관리 (시크릿 불필요)
if (GoogleSignin && typeof GoogleSignin.configure === "function") {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true, // 제거하면 일부 환경에서 DEVELOPER_ERROR 발생
    scopes: SCOPES,
  });
}

/* ────────────────────────────────────────────
   인증 (네이티브 Google Sign-In)
   ──────────────────────────────────────────── */

/** 네이티브 Google 로그인 → 토큰 획득 (라이브러리가 토큰 관리, 시크릿 불필요) */
export async function googleSignIn(): Promise<{
  accessToken: string;
  email: string;
}> {
  const auth = resolveNativeModule("@react-native-google-signin/google-signin");
  if (!auth || typeof auth.signIn !== "function") {
    throw new Error("Google Sign-In is not available on web.");
  }

  await auth.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await auth.signIn();
  const email = signInResult.data?.user?.email ?? "";

  const { accessToken } = await auth.getTokens();
  await AsyncStorage.setItem(KEY_USER_EMAIL, email);

  return { accessToken, email };
}

/** 유효한 Access Token 획득 (라이브러리가 만료 시 자동 갱신) */
export async function getValidAccessToken(): Promise<string | null> {
  try {
    const auth = resolveNativeModule(
      "@react-native-google-signin/google-signin"
    );
    if (!auth || typeof auth.hasPreviousSignIn !== "function") return null;
    if (!auth.hasPreviousSignIn()) return null;
    const { accessToken } = await auth.getTokens();
    return accessToken ?? null;
  } catch {
    return null;
  }
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  try {
    const auth = resolveNativeModule(
      "@react-native-google-signin/google-signin"
    );
    if (auth && typeof auth.signOut === "function") {
      await auth.signOut();
    }
  } catch {
    // 무시
  }
  await AsyncStorage.removeItem(KEY_USER_EMAIL);
}

/** 저장된 이메일 반환 */
export async function getSignedInEmail(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_USER_EMAIL);
}

/** 로그인 상태 확인 */
export async function isSignedIn(): Promise<boolean> {
  const email = await AsyncStorage.getItem(KEY_USER_EMAIL);
  return !!email;
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
async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** 파일 업로드 (multipart — binary) */
async function uploadFileBuffer(
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `업로드 실패 (${res.status})`);
  }
  return res.json();
}

/** 파일 다운로드 (base64) */
async function downloadFileBase64(
  token: string,
  fileId: string
): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ────────────────────────────────────────────
   백업 주기 설정
   ──────────────────────────────────────────── */

/** 백업 주기 조회 (일 단위) */
export async function getBackupIntervalDays(): Promise<number> {
  const val = await AsyncStorage.getItem(KEY_BACKUP_INTERVAL);
  return val ? parseInt(val, 10) : DEFAULT_BACKUP_INTERVAL;
}

/** 백업 주기 저장 (일 단위) */
export async function setBackupIntervalDays(days: number): Promise<void> {
  await AsyncStorage.setItem(KEY_BACKUP_INTERVAL, String(Math.max(1, days)));
}

/* ────────────────────────────────────────────
   백업 / 복원 (ZIP 압축: JSON + 이미지)
   ──────────────────────────────────────────── */

type BackupMetadata = {
  version: number;
  createdAt: string;
  records: string;
  challenge: string | null;
  challengeHistory: string | null;
  userSettings: string | null;
  meals: string | null; // 식사 기록
  imageFiles: string[]; // zip 내 이미지 파일명 목록
};

/** 모든 로컬 데이터를 ZIP으로 압축하여 Google Drive에 업로드 */
export async function performBackup(): Promise<{
  success: boolean;
  error?: string;
}> {
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
    const meals = await AsyncStorage.getItem("meal_entries_v1");

    // 2. ZIP 생성
    const zip = new JSZip();
    const imageFiles: string[] = [];

    // 이미지 수집 → zip에 추가
    try {
      const dirInfo = await LegacyFileSystem.getInfoAsync(PHOTO_DIR);
      if (dirInfo.exists) {
        const files = await LegacyFileSystem.readDirectoryAsync(PHOTO_DIR);
        for (const file of files) {
          const filePath = PHOTO_DIR + file;
          const base64 = await LegacyFileSystem.readAsStringAsync(filePath, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
          zip.file(`images/${file}`, base64, { base64: true });
          imageFiles.push(file);
        }
      }
    } catch {
      // 이미지 폴더가 없으면 무시
    }

    // 메타데이터 JSON → zip에 추가
    const metadata: BackupMetadata = {
      version: 2,
      createdAt: new Date().toISOString(),
      records: records ?? "[]",
      challenge,
      challengeHistory,
      userSettings,
      meals,
      imageFiles,
    };
    zip.file("metadata.json", JSON.stringify(metadata));

    // 3. ZIP → base64
    const zipBase64 = await zip.generateAsync({ type: "base64" });

    // 4. 폴더 확보 + 업로드
    const folderId = await getOrCreateFolder(token);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const fileName = `fullweight_backup_${dateStr}.zip`;

    await uploadFileBuffer(
      token,
      folderId,
      fileName,
      zipBase64,
      "application/zip"
    );

    // 5. 오래된 백업 삭제 (MAX_BACKUPS 초과 시 가장 오래된 것부터 삭제)
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
    console.error("[backup] performBackup 실패:", e);
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

/** 특정 백업 파일(ZIP)에서 데이터 복원 */
export async function performRestore(
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getValidAccessToken();
    if (!token) return { success: false, error: "로그인이 필요합니다" };

    // 1. 파일 다운로드 (base64)
    const base64Content = await downloadFileBase64(token, fileId);

    // 2. ZIP 해제
    const zip = await JSZip.loadAsync(base64Content, { base64: true });

    // 3. metadata.json 읽기
    const metaFile = zip.file("metadata.json");
    if (!metaFile) {
      // v1 호환: ZIP이 아닌 이전 JSON 포맷 시도
      return await performRestoreLegacy(base64Content);
    }
    const metaStr = await metaFile.async("string");
    const metadata: BackupMetadata = JSON.parse(metaStr);

    // 4. 로컬 데이터 복원
    await AsyncStorage.setItem("weight_records_v1", metadata.records);
    if (metadata.challenge) {
      await AsyncStorage.setItem("weight_challenge_v1", metadata.challenge);
    } else {
      await AsyncStorage.removeItem("weight_challenge_v1");
    }
    if (metadata.challengeHistory) {
      await AsyncStorage.setItem(
        "weight_challenge_history_v1",
        metadata.challengeHistory
      );
    } else {
      await AsyncStorage.removeItem("weight_challenge_history_v1");
    }
    if (metadata.userSettings) {
      await AsyncStorage.setItem("user_settings_v1", metadata.userSettings);
    }
    if (metadata.meals) {
      await AsyncStorage.setItem("meal_entries_v1", metadata.meals);
    } else {
      await AsyncStorage.removeItem("meal_entries_v1");
    }

    // 5. 이미지 복원
    const dirInfo = await LegacyFileSystem.getInfoAsync(PHOTO_DIR);
    if (!dirInfo.exists) {
      await LegacyFileSystem.makeDirectoryAsync(PHOTO_DIR, {
        intermediates: true,
      });
    }

    for (const imgName of metadata.imageFiles) {
      const imgFile = zip.file(`images/${imgName}`);
      if (imgFile) {
        const imgBase64 = await imgFile.async("base64");
        const destPath = PHOTO_DIR + imgName;
        await LegacyFileSystem.writeAsStringAsync(destPath, imgBase64, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });
      }
    }

    return { success: true };
  } catch (e: any) {
    console.error("[backup] performRestore 실패:", e);
    return { success: false, error: e?.message ?? "복원 실패" };
  }
}

/** v1 레거시 JSON 포맷 복원 호환 */
async function performRestoreLegacy(
  base64Content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const jsonStr = decodeURIComponent(
      atob(base64Content)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonStr);

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

    // v1 이미지 복원
    if (payload.images && payload.images.length > 0) {
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
    return { success: false, error: e?.message ?? "복원 실패 (레거시)" };
  }
}

/** 마지막 백업 시간 가져오기 */
export async function getLastBackupTime(): Promise<number | null> {
  const ts = await AsyncStorage.getItem(KEY_LAST_BACKUP);
  return ts ? parseInt(ts, 10) : null;
}

/** 자동 백업 필요 여부 확인 (사용자 설정 간격 기준) */
export async function shouldAutoBackup(): Promise<boolean> {
  const signedIn = await isSignedIn();
  if (!signedIn) return false;

  const lastBackup = await getLastBackupTime();
  if (!lastBackup) return true; // 한번도 백업 안 했으면

  const intervalDays = await getBackupIntervalDays();
  const elapsed = Date.now() - lastBackup;
  return elapsed > intervalDays * 24 * 60 * 60 * 1000;
}
