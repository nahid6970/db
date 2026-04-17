# Share Text - Convex Version

A powerful, markdown-enabled text sharing application powered by a Convex backend and a clean, responsive vanilla HTML/JS frontend.

## 🚀 Key Features

- **Rich Markdown Rendering**: Full support for standard Markdown, including headers, lists, tables, and formatted text.
- **Syntax Highlighting**: Automatic code block highlighting for multiple languages.
- **Advanced Text Controls**:
  - **Pin to Top**: Keep important notes at the top of your list.
  - **Edit Modal**: A spacious, dedicated interface for modifying existing entries.
  - **Read More Delimiter**: Use five or more greater-than signs (`>>>>>`) to split long notes into a preview and a toggleable detail section.
- **Custom Color Syntax**: Define your own triggers (e.g., `@@text@@` or `##text##`) in Settings to apply custom foreground and background colors.
- **Modern Icon UI**: Streamlined interface using SVG icons for all primary actions.
- **Real-time Persistence**: All data is stored and synced via Convex mutations and queries.
- **Auto-Refresh**: Stay up to date with the latest shared texts automatically.

## 🛠️ Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Convex**:
   ```bash
   npx convex dev
   ```
   - This will create a Convex account if needed.
   - Copy the **deployment URL** provided (e.g., `https://xxx.convex.cloud`).
   - Keep this terminal running during development.

3. **Configure Frontend**:
   - Open `index.html`.
   - Ensure the `client` initialization uses your actual Convex URL.

4. **Run Locally**:
   - Open `index.html` in your browser.
   - Start sharing, pinning, and styling your notes!

## 🔧 Deployment

1. **Deploy Backend**:
   ```bash
   npx convex deploy
   ```
2. **Update Production URL**: Copy the production deployment URL into `index.html`.
3. **Host Frontend**: Deploy `index.html` to any static host (GitHub Pages, Netlify, Vercel, etc.).

## 📝 Usage Tips

- **Pinning**: Click the 📌 icon to keep an entry at the top. Click again to unpin.
- **Preview/Details**: Insert `>>>>>` in your text to hide long content behind a "Show More" button.
- **Custom Styling**: Go to **Settings** to add triggers like `@@` or `!!`. Then use them in your notes like `@@Your colored text@@` to apply specific styles.
- **Copying**: Use the copy icon to quickly grab the raw markdown source of any entry.
