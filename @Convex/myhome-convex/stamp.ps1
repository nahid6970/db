$time = Get-Date -Format "yyyy-MM-dd hh:mm tt"
$file = "index.html"
if (Test-Path $file) {
    (Get-Content $file) -replace 'Local Update: .*?</div>', "Local Update: $time</div>" | Set-Content $file
    Write-Host "✅ index.html updated with: Local Update: $time" -ForegroundColor Green
} else {
    Write-Host "❌ index.html not found!" -ForegroundColor Red
}
