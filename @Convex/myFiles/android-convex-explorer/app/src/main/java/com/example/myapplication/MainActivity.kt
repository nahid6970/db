package com.example.myapplication

import android.app.AlertDialog
import android.os.Bundle
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var convexClient: ConvexClient
    private lateinit var adapter: FileAdapter
    private lateinit var recyclerView: RecyclerView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        convexClient = ConvexClient("https://good-basilisk-52.convex.cloud")
        
        recyclerView = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
        }
        setContentView(recyclerView)
        
        adapter = FileAdapter(
            this,
            emptyList(),
            onRename = { file -> showRenameDialog(file) },
            onDelete = { file -> deleteFile(file) }
        )
        recyclerView.adapter = adapter
        
        loadFiles()
    }

    private fun loadFiles() {
        lifecycleScope.launch {
            try {
                val files = convexClient.listFiles()
                adapter.updateFiles(files)
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showRenameDialog(file: FileItem) {
        val input = EditText(this).apply {
            setText(file.filename)
        }
        
        AlertDialog.Builder(this)
            .setTitle("Rename File")
            .setView(input)
            .setPositiveButton("Rename") { _, _ ->
                val newName = input.text.toString()
                if (newName.isNotBlank()) {
                    renameFile(file, newName)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun renameFile(file: FileItem, newName: String) {
        lifecycleScope.launch {
            try {
                convexClient.renameFile(file.id, newName)
                loadFiles()
                Toast.makeText(this@MainActivity, "Renamed", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun deleteFile(file: FileItem) {
        AlertDialog.Builder(this)
            .setTitle("Delete File")
            .setMessage("Delete ${file.filename}?")
            .setPositiveButton("Delete") { _, _ ->
                lifecycleScope.launch {
                    try {
                        convexClient.deleteFile(file.id)
                        loadFiles()
                        Toast.makeText(this@MainActivity, "Deleted", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
