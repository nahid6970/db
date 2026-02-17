# Cloud-Share Android App

Upload files directly to Cloudinary + Convex from Android share menu.

## Setup

1. **Update credentials in `ShareActivity.kt`:**
   ```kotlin
   private val CONVEX_URL = "YOUR_CONVEX_URL_HERE"
   private val CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME"
   private val CLOUDINARY_UPLOAD_PRESET = "myFiles"
   ```

2. **Build the APK:**
   ```bash
   cd Cloud-Share
   ./gradlew assembleDebug
   ```
   APK will be at: `app/build/outputs/apk/debug/app-debug.apk`

3. **Install on Android device**

## Usage

1. Open any file in any app (Gallery, Files, etc.)
2. Tap Share button
3. Select "Cloud-Share"
4. Files upload automatically to your myFiles project
5. View them in real-time on your HTML page!

## How It Works

- Android app uploads files to Cloudinary (raw/upload endpoint)
- Saves file metadata to Convex database
- HTML page shows files in real-time via Convex subscriptions
- No Flask server needed!

## Requirements

- Android 7.0+ (API 24)
- Internet permission
- Storage read permission
