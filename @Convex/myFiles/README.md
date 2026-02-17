# File Share

Share any type of file with real-time sync using Convex and Cloudinary.

## Setup

1. **Install dependencies:**
   ```bash
   cd myFiles
   npm install
   ```

2. **Set up Convex:**
   ```bash
   npx convex dev
   ```
   This will create a new Convex project and generate your deployment URL.

3. **Set up Cloudinary:**
   - Go to [cloudinary.com](https://cloudinary.com) and create a free account
   - Go to Settings → Upload → Upload presets
   - Create a new preset named `myFiles`
   - Set it to "Unsigned"
   - Set folder to `myFiles`

4. **Update index.html:**
   - Replace `YOUR_CONVEX_URL_HERE` with your Convex deployment URL
   - Replace `YOUR_CLOUD_NAME` with your Cloudinary cloud name

5. **Open index.html in your browser**

## Features

- Upload any file type
- Real-time file list updates
- Download files
- Delete individual files or clear all
- File size and type display
- Progress tracking for uploads

## Tech Stack

- Convex (backend & database)
- Cloudinary (file storage)
- Vanilla JavaScript (frontend)
