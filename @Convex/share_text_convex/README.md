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

- **Integrated Sticky Header**: 
  - **Folders on the Left**: Your entire folder navigation is now part of the sticky header.
  - **Smart Wrapping**: Folders automatically wrap to new lines as the list grows, ensuring they never overlap with the action buttons.
  - **Sticky Actions**: The **+ (New Note)** and **Gear (Settings)** icons stay fixed on the right for instant access.
- **Improved Settings Experience**:
  - **Optimized Scrolling**: The Settings modal now features a robust flexbox layout that handles large amounts of custom data without overflowing the screen.
  - **Tabbed Management**: Dedicated tabs for **Color Styles** and **Folder Config**.
  - **Instant UI Refresh**: Folder deletions and reorderings are reflected immediately across the entire interface.
- **Modal-Based Creation**: Home page stays focused on reading while creation happens in a dedicated, streamlined modal.
- **Rich Markdown & Math**: Full support for standard Markdown and LaTeX math equations (Inline `$ ... $` and Block `$$ ... $$`).
- **Custom Color Syntax**: 
  - Define your own triggers in **Settings**.
  - **F3 Quick Format**: Apply styles instantly to selected text while adding or editing.
- **Advanced Text Controls**:
  - **Individual Note Styling**: Custom colors for the entire note.
  - **Pin to Top**: Keep critical information at the top of your feed.
  - **Pill-Shaped Toggles**: Modern "Show More" buttons for long logs using the `>>>>>` delimiter.
- **Folder Management**: 
  - **None Folder**: Special view for uncategorized content.
  - **Folder Customization**: Personalize each folder with unique background, text, and border colors.
  - **Rearrange Order**: Simple up-arrow (▲) sorting to prioritize your workspace.
- **Real-time Sync**: Multi-device synchronization powered by Convex.

## 🛠️ Setup Instructions

1. **Install dependencies**: `npm install`
2. **Initialize Convex**: `npx convex dev`
3. **Run Locally**: Open `index.html` in your browser.

## 🔧 Deployment

1. **Deploy Backend**: `npx convex deploy`
2. **Update index.html**: Ensure the `client` uses your production Convex URL.
3. **Host Frontend**: Deploy `index.html` to any static hosting service.

## 📝 Usage Tips

- **Add Note**: Click the green **+** icon in the header.
- **Settings**: Click the gear icon to manage triggers and folders.
- **Folders**: Navigate via the chips on the left of the header. The **Dot Icon** shows your current location.
- **Sorting**: Prioritize folders by moving them up in the Folder Config tab.
- **Scrollable Settings**: Don't worry about adding too many styles; the settings menu now scrolls smoothly to handle any amount of customization.
