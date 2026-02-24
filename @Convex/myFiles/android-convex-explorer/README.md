# Android Convex File Explorer

Minimal Android app to browse and manage files stored in Convex.

## Setup

1. **Update Convex URL:**
   Open `app/src/main/java/com/example/myapplication/MainActivity.kt` and replace:
   ```kotlin
   convexClient = ConvexClient("YOUR_CONVEX_URL_HERE")
   ```
   with your actual Convex deployment URL (e.g., `https://your-deployment.convex.cloud`)

2. **Build and run:**
   ```bash
   cd android-convex-explorer
   ./gradlew assembleDebug
   ```
   Or open in Android Studio and run.

## Features

- View all files from Convex storage
- Tap to open files with system apps
- Long press for context menu:
  - Open
  - Download
  - Rename
  - Delete
- Minimal, clean UI using Material Design

## Requirements

- Android 7.0 (API 24) or higher
- Internet permission for Convex API calls
