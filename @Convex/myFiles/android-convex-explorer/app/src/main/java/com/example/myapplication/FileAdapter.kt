package com.example.myapplication

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.PopupMenu
import android.widget.TextView
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.RecyclerView
import java.io.File

class FileAdapter(
    private val context: Context,
    private var files: List<FileItem>,
    private val onRename: (FileItem) -> Unit,
    private val onDelete: (FileItem) -> Unit
) : RecyclerView.Adapter<FileAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val filename: TextView = view.findViewById(android.R.id.text1)
        val fileInfo: TextView = view.findViewById(android.R.id.text2)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(android.R.layout.simple_list_item_2, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val file = files[position]
        holder.filename.text = file.filename
        holder.fileInfo.text = "${formatSize(file.fileSize)} • ${file.fileType}"
        
        holder.itemView.setOnClickListener {
            openFile(file)
        }
        
        holder.itemView.setOnLongClickListener {
            showContextMenu(it, file)
            true
        }
    }

    override fun getItemCount() = files.size

    fun updateFiles(newFiles: List<FileItem>) {
        files = newFiles
        notifyDataSetChanged()
    }

    private fun openFile(file: FileItem) {
        val url = file.url ?: file.storageId?.let { "convex://$it" } ?: return
        
        if (url.startsWith("http")) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(Intent.createChooser(intent, "Open with"))
        } else {
            downloadAndOpen(file)
        }
    }

    private fun downloadAndOpen(file: FileItem) {
        val storageId = file.storageId ?: return
        val request = DownloadManager.Request(Uri.parse("convex://$storageId"))
            .setTitle(file.filename)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, file.filename)
        
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        dm.enqueue(request)
    }

    private fun showContextMenu(view: View, file: FileItem) {
        PopupMenu(context, view).apply {
            menu.add("Open")
            menu.add("Download")
            menu.add("Rename")
            menu.add("Delete")
            
            setOnMenuItemClickListener { item ->
                when (item.title) {
                    "Open" -> openFile(file)
                    "Download" -> downloadFile(file)
                    "Rename" -> onRename(file)
                    "Delete" -> onDelete(file)
                }
                true
            }
            show()
        }
    }

    private fun downloadFile(file: FileItem) {
        val url = file.url ?: return
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(file.filename)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, file.filename)
        
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        dm.enqueue(request)
    }

    private fun formatSize(bytes: Long): String {
        return when {
            bytes < 1024 -> "$bytes B"
            bytes < 1024 * 1024 -> "${bytes / 1024} KB"
            else -> "${bytes / (1024 * 1024)} MB"
        }
    }
}
