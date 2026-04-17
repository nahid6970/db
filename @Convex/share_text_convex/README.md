# Share Text - Convex Version

A powerful, markdown-enabled text sharing application powered by a Convex backend and a clean, responsive vanilla HTML/JS frontend.

## ⚠️ Reserved Syntaxes (Avoid in Custom Triggers)

To avoid conflicts with standard Markdown and project features, do **not** use the following symbols as your custom color syntax triggers in Settings:

| Category | Reserved Symbols |
| :--- | :--- |
| **Project Specific** | `>>>>>` (used for Read More/Preview split) |
| **Math** | `$`, `$$` (Inline and Block math) |
| **Headers** | `#`, `##`, `###`, `####`, `#####`, `######` |
| **Emphasis** | `**`, `__` (Bold), `*`, `_` (Italic), `~~` (Strikethrough) |
| **Lists** | `- `, `* `, `+ `, `1. ` |
| **Code** | `` ` `` (Inline), ` ``` ` (Block) |
| **Others** | `> ` (Quotes), `[ ]` (Links/Images), `|` (Tables), `---` (Horizontal Rule) |

## 🚀 Key Features

- **Rich Markdown Rendering**: Full support for standard Markdown, including headers, lists, tables, and formatted text.
- **Math Rendering (KaTeX)**: Support for both inline math (`$E=mc^2$`) and block math (`$$ \int f(x) dx $$`).
- **Syntax Highlighting**: Automatic code block highlighting for multiple languages.
- **Advanced Text Controls**:
  - **Pin to Top**: Keep important notes at the top of your list with distinctive styling.
  - **Edit Modal**: A spacious interface for modifying entries, now with **individual note color customization** (foreground and background).
  - **Read More Delimiter**: Use five or more greater-than signs (`>>>>>`) to split long notes into a preview and a toggleable detail section.
- **Custom Color Syntax**: 
  - Define your own triggers (e.g., `@@`, `##`) in Settings.
  - Apply custom foreground and background colors.
  - **Transparency Support**: Toggle "No Text" or "No BG" for flexible styling.
  - **Live Preview**: See your style changes instantly in the settings modal.
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

- **Pinning**: Click the 📌 icon to keep an entry at the top. Pinned notes have a distinctive purple border.
- **Math Expressions**: Use single `$` for inline math (e.g., `$x+y$`) and double `$$` for centered block math.
- **Preview/Details**: Insert `>>>>>` in your text to hide long content behind a "Show More" button.
- **Individual Styling**: When editing a note, use the color pickers in the modal header to change the background and text color of that specific note.
- **Custom Syntax Triggers**: Go to **Settings** to add triggers. Use them in your notes like `@@Your colored text@@` to apply the predefined styles.
- **Copying**: Use the copy icon to quickly grab the raw markdown source of any entry.
