# Share Text - Convex Version

A powerful, markdown-enabled text sharing application powered by a Convex backend and a clean, responsive vanilla HTML/JS frontend.

## ⚠️ Reserved Syntaxes (Avoid in Custom Triggers)

To avoid conflicts with standard Markdown and project features, do **not** use the following symbols as your custom color syntax triggers in Settings:

| Category | Reserved Symbols |
| :--- | :--- |
| **Project Specific** | `>>>>>` (Read More split), `$`, `$$` (Math) |
| **Headers** | `#`, `##`, `###`, `####`, `#####`, `######` |
| **Emphasis** | `**`, `__` (Bold), `*`, `_` (Italic), `~~` (Strikethrough) |
| **Lists** | `- `, `* `, `+ `, `1. ` |
| **Code** | `` ` `` (Inline), ` ``` ` (Block) |
| **Others** | `> ` (Quotes), `[ ]` (Links/Images), `|` (Tables), `---` (Horizontal Rule) |

## 🚀 Key Features

- **Rich Markdown & Math**: Full support for standard Markdown and LaTeX math equations (Inline `$ ... $` and Block `$$ ... $$`).
- **Syntax Highlighting**: Automatic code block highlighting for multiple languages.
- **Custom Color Syntax**: 
  - Define your own triggers (e.g., `@@text@@`) in **Settings**.
  - Support for custom foreground and background colors.
  - **Transparency Options**: Toggle "No Text" or "No BG" for flexible, layered styling.
  - **F3 Quick Format**: Highlight text in the edit modal and press **F3** to pick and apply a custom style instantly.
- **Advanced Text Controls**:
  - **Individual Note Styling**: Use the color pickers in the edit modal header to change the text and background color of the entire note.
  - **Pin to Top**: Keep important notes at the top with a prominent purple border and light purple background.
  - **Read More Delimiter**: Use five or more greater-than signs (`>>>>>`) to create a preview/detail split with a modern **pill-shaped toggle button**.
- **Folder Management**: 
  - **None Folder**: Special view for notes not assigned to any folder.
  - **Auto-Assignment**: New notes are automatically added to the currently active folder.
  - **Custom Folder Styling**: Customize each folder's background, text, and border color in Settings.
  - **Rearrange Order**: Use the up arrow (▲) in Settings to move folders to the top and organize your navigation.
  - **Visual Indicator**: Active folders are marked with a distinct **dot icon**.
- **Tabbed Settings Modal**: 
  - **Color Styles**: Manage your custom markdown triggers.
  - **Folder Config**: Centrally manage folder names, styles, sorting, and deletion.
- **Modern Icon UI**: Clean, minimalist interface using SVG icons for all primary actions.
- **Real-time Sync**: Instant persistence and multi-device synchronization via Convex.

## 🛠️ Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Convex**:
   ```bash
   npx convex dev
   ```

3. **Run Locally**:
   - Open `index.html` in your browser.
   - Start sharing and styling your notes!

## 🔧 Deployment

1. **Deploy Backend**: `npx convex deploy`
2. **Update index.html**: Ensure the `client` uses your production Convex URL.
3. **Host Frontend**: Deploy `index.html` to any static hosting service.

## 📝 Usage Tips

- **Math**: Render beautiful formulas like `$E = mc^2$`.
- **F3 Shortcut**: Quickly style specific words or phrases while editing.
- **Note Colors**: Style entire "notebooks" by clicking the color pickers in the edit modal.
- **Folders**: Organize your workspace by grouping related notes into custom folders. The "None" folder helps you find uncategorized content.
- **Sorting**: Move your most used folders to the beginning of the list using the Folder Config settings.
