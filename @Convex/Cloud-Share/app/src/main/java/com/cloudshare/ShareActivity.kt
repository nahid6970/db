package com.cloudshare

import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class ShareActivity : ComponentActivity() {

    // REPLACE WITH YOUR CREDENTIALS
    private val CONVEX_URL = "https://good-basilisk-52.convex.cloud"
    private val CLOUDINARY_CLOUD_NAME = "dwc7hjiub"
    private val CLOUDINARY_UPLOAD_PRESET = "myFiles"

    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val files = getSharedFiles()

        setContent {
            MaterialTheme {
                UploadScreen(files)
            }
        }
    }

    private fun getSharedFiles(): List<FileInfo> {
        val files = mutableListOf<FileInfo>()
        
        when (intent?.action) {
            Intent.ACTION_SEND -> {
                intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { uri ->
                    files.add(getFileInfo(uri))
                }
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.forEach { uri ->
                    files.add(getFileInfo(uri))
                }
            }
        }
        
        return files
    }

    private fun getFileInfo(uri: Uri): FileInfo {
        var name = "unknown"
        var size = 0L
        var mimeType = contentResolver.getType(uri) ?: "application/octet-stream"

        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                name = cursor.getString(nameIndex)
                size = cursor.getLong(sizeIndex)
            }
        }

        return FileInfo(uri, name, size, mimeType)
    }

    @Composable
    fun UploadScreen(files: List<FileInfo>) {
        val scope = rememberCoroutineScope()
        var uploadStates by remember { mutableStateOf(files.map { UploadState.Pending }) }
        var isUploading by remember { mutableStateOf(false) }

        LaunchedEffect(Unit) {
            isUploading = true
            files.forEachIndexed { index, file ->
                uploadStates = uploadStates.toMutableList().apply { this[index] = UploadState.Uploading(0) }
                
                try {
                    uploadFile(file) { progress ->
                        uploadStates = uploadStates.toMutableList().apply { 
                            this[index] = UploadState.Uploading(progress) 
                        }
                    }
                    uploadStates = uploadStates.toMutableList().apply { this[index] = UploadState.Success }
                } catch (e: Exception) {
                    uploadStates = uploadStates.toMutableList().apply { 
                        this[index] = UploadState.Error(e.message ?: "Failed") 
                    }
                }
            }
            isUploading = false
        }

        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Uploading to Cloud", style = MaterialTheme.typography.headlineSmall)
                Spacer(modifier = Modifier.height(16.dp))

                LazyColumn(modifier = Modifier.weight(1f)) {
                    items(files.zip(uploadStates)) { (file, state) ->
                        FileUploadItem(file, state)
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                if (!isUploading) {
                    Button(onClick = { finish() }) {
                        Text("Done")
                    }
                }
            }
        }
    }

    @Composable
    fun FileUploadItem(file: FileInfo, state: UploadState) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(file.name, style = MaterialTheme.typography.bodyMedium)
                Text("${file.size / 1024} KB", style = MaterialTheme.typography.bodySmall)
                
                Spacer(modifier = Modifier.height(8.dp))
                
                when (state) {
                    is UploadState.Pending -> Text("Waiting...")
                    is UploadState.Uploading -> {
                        LinearProgressIndicator(
                            progress = state.progress / 100f,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("${state.progress}%")
                    }
                    is UploadState.Success -> Text("✓ Uploaded", color = MaterialTheme.colorScheme.primary)
                    is UploadState.Error -> Text("✗ ${state.message}", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }

    private suspend fun uploadFile(fileInfo: FileInfo, onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        val tempFile = File(cacheDir, fileInfo.name)
        contentResolver.openInputStream(fileInfo.uri)?.use { input ->
            FileOutputStream(tempFile).use { output ->
                input.copyTo(output)
            }
        }

        // Upload to Cloudinary
        val cloudinaryUrl = uploadToCloudinary(tempFile, onProgress)

        // Save to Convex
        saveToConvex(cloudinaryUrl, fileInfo)

        tempFile.delete()
    }

    private fun uploadToCloudinary(file: File, onProgress: (Int) -> Unit): String {
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", file.name, file.asRequestBody("application/octet-stream".toMediaType()))
            .addFormDataPart("upload_preset", CLOUDINARY_UPLOAD_PRESET)
            .addFormDataPart("folder", "myFiles")
            .build()

        val request = Request.Builder()
            .url("https://api.cloudinary.com/v1_1/$CLOUDINARY_CLOUD_NAME/raw/upload")
            .post(requestBody)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Cloudinary upload failed")
            
            val json = JSONObject(response.body!!.string())
            return json.getString("secure_url")
        }
    }

    private fun saveToConvex(url: String, fileInfo: FileInfo) {
        val json = JSONObject().apply {
            put("url", url)
            put("filename", fileInfo.name)
            put("fileType", fileInfo.mimeType)
            put("fileSize", fileInfo.size)
        }

        val requestBody = RequestBody.create(
            "application/json".toMediaType(),
            JSONObject().apply {
                put("path", "files:add")
                put("args", json)
                put("format", "json")
            }.toString()
        )

        val request = Request.Builder()
            .url("$CONVEX_URL/api/mutation")
            .post(requestBody)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Convex save failed")
        }
    }

    data class FileInfo(val uri: Uri, val name: String, val size: Long, val mimeType: String)

    sealed class UploadState {
        object Pending : UploadState()
        data class Uploading(val progress: Int) : UploadState()
        object Success : UploadState()
        data class Error(val message: String) : UploadState()
    }
}
