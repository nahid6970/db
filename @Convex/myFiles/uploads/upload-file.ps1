param($FilePath)

# Copy file to uploads folder and open the HTML page
$uploadsDir = "C:\@delta\db\@Convex\myFiles\uploads"
if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
}

Copy-Item -Path $FilePath -Destination $uploadsDir -Force

# Open the HTML page
Start-Process "C:\@delta\db\@Convex\myFiles\index.html"

# Show notification
$fileName = Split-Path $FilePath -Leaf
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show("File '$fileName' copied to uploads folder!`n`nNow upload it from the web page.", "Ready to Upload", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
