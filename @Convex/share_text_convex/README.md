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
  - **F3 Quick Format**: Highlight text in the edit modal and press **F3** to pick and apply a custom style instantly, or use the **Clear All Styles** option to strip all custom triggers from the selection.
- **Advanced Text Controls**:
  - **Individual Note Styling**: Use the color pickers in the edit modal header to change the text and background color of the entire note.
  - **Pin to Top**: Keep important notes at the top with a prominent purple border and light purple background.
  - **Read More Delimiter**: Use five or more greater-than signs (`>>>>>`) to create a preview/detail split.
  - **Edit Modal**: A large, dedicated popup for comfortable long-form editing.
- **Folder Management**: 
  - Create horizontal folders that wrap to new rows as needed.
  - Move notes between folders using the dropdown in the **Edit Modal**.
  - Filter notes by selecting a folder; shared notes are automatically added to the active folder.
- **Modern Icon UI**: Clean interface using SVG icons for all primary actions.
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
- **Note Colors**: Style entire "notebooks" by clicking the color pickers beside the close button in the edit modal.
- **Folders**: Organize your workspace by grouping related notes into custom folders.
- **Preview/Details**: Keep your list organized by hiding long logs behind the `>>>>>` trigger.
