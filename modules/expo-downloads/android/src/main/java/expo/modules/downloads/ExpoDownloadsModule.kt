package expo.modules.downloads

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class ExpoDownloadsModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoDownloads")

        AsyncFunction("saveToDownloads") { sourcePath: String, fileName: String, mimeType: String ->
            val context = appContext.reactContext
                ?: throw Exception("Context를 가져올 수 없습니다.")

            val cleanPath = sourcePath.removePrefix("file://")
            val sourceFile = File(cleanPath)
            if (!sourceFile.exists()) {
                throw Exception("소스 파일을 찾을 수 없습니다.")
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+) - MediaStore API
                val resolver = context.contentResolver

                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }

                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: throw Exception("Downloads 폴더에 파일을 생성할 수 없습니다.")

                try {
                    resolver.openOutputStream(uri)?.use { outputStream ->
                        sourceFile.inputStream().use { inputStream ->
                            inputStream.copyTo(outputStream)
                        }
                    } ?: throw Exception("파일 쓰기에 실패했습니다.")

                    // 쓰기 완료 표시
                    val updateValues = ContentValues().apply {
                        put(MediaStore.Downloads.IS_PENDING, 0)
                    }
                    resolver.update(uri, updateValues, null, null)
                } catch (e: Exception) {
                    // 실패 시 생성된 항목 삭제
                    resolver.delete(uri, null, null)
                    throw e
                }

                uri.toString()
            } else {
                // Android 9 이하 - 직접 파일 복사
                val downloadsDir = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS
                )
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val destFile = File(downloadsDir, fileName)
                sourceFile.copyTo(destFile, overwrite = true)
                destFile.absolutePath
            }
        }
    }
}
