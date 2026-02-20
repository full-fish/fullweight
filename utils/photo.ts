import * as LegacyFileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

const PHOTO_DIR = `${LegacyFileSystem.documentDirectory}photos/`;

/** photos 디렉토리 존재 보장 */
async function ensureDir() {
  const info = await LegacyFileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await LegacyFileSystem.makeDirectoryAsync(PHOTO_DIR, {
      intermediates: true,
    });
  }
}

/** 카메라로 사진 촬영 → 로컬 저장 후 URI 반환 */
export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    allowsEditing: true,
    aspect: [3, 4],
  });
  if (result.canceled || !result.assets[0]) return null;
  return savePhoto(result.assets[0].uri);
}

/** 갤러리에서 사진 선택 → 로컬 저장 후 URI 반환 */
export async function pickPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsEditing: true,
    aspect: [3, 4],
  });
  if (result.canceled || !result.assets[0]) return null;
  return savePhoto(result.assets[0].uri);
}

/** 임시 URI → 영구 로컬 저장 */
async function savePhoto(tempUri: string): Promise<string> {
  await ensureDir();
  const filename = `photo_${Date.now()}.jpg`;
  const dest = `${PHOTO_DIR}${filename}`;
  await LegacyFileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

/** 사진 삭제 */
export async function deletePhoto(uri: string): Promise<void> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri);
    if (info.exists) await LegacyFileSystem.deleteAsync(uri);
  } catch {
    // ignore
  }
}
