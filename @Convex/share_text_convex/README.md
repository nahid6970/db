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

- **Sticky Action Header**: Primary actions are always accessible at the top of the screen with a modern blurred glass effect.
- **Icon-Driven Interface**: Clean SVG icons for all actions, including the new **Green Plus** for notes and **Gear Icon** for settings.
- **Modal-Based Creation**: Notes are added via a dedicated modal, keeping the home page focused on your content.
- **Rich Markdown & Math**: Full support for standard Markdown and LaTeX math equations (Inline `$ ... $` and Block `$$ ... $$`).
- **Syntax Highlighting**: Automatic code block highlighting for multiple languages.
- **Custom Color Syntax**: 
  - Define your own triggers (e.g., `@@text@@`) in **Settings**.
  - Support for custom foreground and background colors.
  - **F3 Quick Format**: Highlight text in any note modal and press **F3** to apply styles instantly.
- **Advanced Text Controls**:
  - **Individual Note Styling**: Custom colors for the entire note via edit modal pickers.
  - **Pin to Top**: Highlight and stick important notes to the top of your feed.
  - **Pill-Shaped Toggles**: Modern "Show More/Less" buttons for long logs using the `>>>>>` delimiter.
- **Folder Management**: 
  - **None Folder**: Special view for uncategorized notes.
  - **Folder Styling & Sorting**: Customize colors and rearrange the order of your folders in Settings.
  - **Active Dot Indicator**: A visual dot marks your current folder location.
- **Tabbed Settings**: Organized management of color syntaxes and folder configurations.
- **Real-time Sync**: Instant multi-device synchronization powered by Convex.

## 🛠️ Setup Instructions

1. **Install dependencies**: `npm install`
2. **Initialize Convex**: `npx convex dev`
3. **Run Locally**: Open `index.html` in your browser.

## 🔧 Deployment

1. **Deploy Backend**: `npx convex deploy`
2. **Update index.html**: Ensure the `client` uses your production Convex URL.
3. **Host Frontend**: Deploy `index.html` to any static hosting service.

## 📝 Usage Tips

- **Add Note**: Click the green **+** icon in the sticky header.
- **Settings**: Click the gear icon in the sticky header to customize triggers or folders.
- **F3 Shortcut**: Quickly style selected text while adding or editing a note.
- **Rearrange**: Use the up arrow (▲) in Folder Config to prioritize your folder list.
- **Math**: Render formulas like `$E = mc^2$` with KaTeX.
