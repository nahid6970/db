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
  - Transparency options ("No Text", "No BG") for flexible styling.
  - **F3 Quick Format**: Press `F3` while editing to quickly apply your triggers to selected text.
- **Advanced Text Controls**:
  - **Individual Note Styling**: Change the entire color scheme (text and background) for any specific note.
  - **Pin to Top**: Keep important notes at the top with a prominent purple border.
  - **Read More Delimiter**: Use five or more greater-than signs (`>>>>>`) to create a preview/detail split.
  - **Edit Modal**: A large, dedicated popup for comfortable long-form editing.
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
- **F3 Shortcut**: Highlight text in the edit modal and press **F3** to pick a custom style instantly.
- **Note Colors**: While editing a note, use the color pickers in the header to change its "notebook" color.
- **Preview/Details**: Insert `>>>>>` in your text to hide extra content behind a "Show More" button.
