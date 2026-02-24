package com.example.myapplication

data class FileItem(
    val id: String,
    val filename: String,
    val fileType: String,
    val fileSize: Long,
    val storageId: String?,
    val url: String?
)
