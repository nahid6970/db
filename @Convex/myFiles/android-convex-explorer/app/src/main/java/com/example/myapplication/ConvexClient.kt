package com.example.myapplication

import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ConvexClient(private val deploymentUrl: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val gson = Gson()

    suspend fun listFiles(): List<FileItem> = withContext(Dispatchers.IO) {
        val json = JsonObject().apply {
            addProperty("path", "files:list")
            add("args", JsonObject())
        }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url(deploymentUrl).post(body).build()
        
        client.newCall(request).execute().use { response ->
            val result = gson.fromJson(response.body?.string(), JsonObject::class.java)
            val files = result.getAsJsonArray("value")
            files.map { 
                val obj = it.asJsonObject
                FileItem(
                    id = obj.get("_id").asString,
                    filename = obj.get("filename").asString,
                    fileType = obj.get("fileType").asString,
                    fileSize = obj.get("fileSize").asLong,
                    storageId = obj.get("storageId")?.asString,
                    url = obj.get("url")?.asString
                )
            }
        }
    }

    suspend fun getFileUrl(storageId: String): String? = withContext(Dispatchers.IO) {
        val json = JsonObject().apply {
            addProperty("path", "files:getUrl")
            add("args", JsonObject().apply {
                addProperty("storageId", storageId)
            })
        }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url(deploymentUrl).post(body).build()
        
        client.newCall(request).execute().use { response ->
            val result = gson.fromJson(response.body?.string(), JsonObject::class.java)
            result.get("value")?.asString
        }
    }

    suspend fun deleteFile(fileId: String) = withContext(Dispatchers.IO) {
        val json = JsonObject().apply {
            addProperty("path", "files:remove")
            add("args", JsonObject().apply {
                addProperty("id", fileId)
            })
        }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url(deploymentUrl).post(body).build()
        client.newCall(request).execute().close()
    }

    suspend fun renameFile(fileId: String, newName: String) = withContext(Dispatchers.IO) {
        val json = JsonObject().apply {
            addProperty("path", "files:rename")
            add("args", JsonObject().apply {
                addProperty("id", fileId)
                addProperty("filename", newName)
            })
        }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url(deploymentUrl).post(body).build()
        client.newCall(request).execute().close()
    }
}
