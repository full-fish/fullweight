import { requireNativeModule } from "expo-modules-core";

const ExpoDownloads = requireNativeModule("ExpoDownloads");

/**
 * 파일을 Android Downloads 폴더에 저장합니다.
 * @param sourcePath 소스 파일 경로 (캐시 등)
 * @param fileName 저장할 파일명
 * @param mimeType MIME 타입
 * @returns 저장된 URI
 */
export async function saveToDownloads(
  sourcePath: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  return await ExpoDownloads.saveToDownloads(sourcePath, fileName, mimeType);
}
