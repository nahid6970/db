# Cyberpunk Script Manager V3

A state-of-the-art, feature-rich PyQt6 graphical script launcher and manager designed with a sleek Cyberpunk aesthetic. Organize all of your scripts, workflows, and folders into a unified console with granular execution controls, high levels of UI customization, and cloud synchronization.

---

## 🚀 Key Features

### 1. **Grid-Based Dashboard & Folders**
- Organize scripts into hierarchical folders and grids.
- Breadcrumb navigation for quick folder path jumping.
- Drag-and-drop support for reordering and organizing buttons.

### 2. **Rich Aesthetic Customizations**
- **Theme Palette:** Built-in support for neon colors (Cyber Yellow, Neon Cyan, Neon Red, success greens, and dark mode panels).
- **Interactive SVG Icons:** Directly paste raw SVG code, pick/replace base colors, and set hover overrides.
- **Typography control:** Customize font families, sizes, bold/italic options, button dimensions, corner rounding, and borders per script.

### 3. **Granular Execution Controls**
- Run scripts inline or in external windows.
- Configure execution behaviors:
  - **Hide Term:** Run hidden in the background.
  - **Keep Open:** Keep the shell open after completion.
  - **Kill Launch:** Terminate previous instances when running again.
  - **New Terminal:** Launch in a separate command prompt instance.
  - **Run as Admin:** Automatically elevate process privileges.
- **Password Lock:** Protect high-sensitivity scripts with password prompt authorization.

### 4. **Ctrl+Click Shortcuts (Modular presetting)**
- Configure custom actions for **Ctrl + Left Click** and **Ctrl + Right Click**.
- **Default Fallback:** Ctrl+Left Click automatically opens the script's directory in Windows Explorer.
- **Dynamic Command Resolution:** Use dynamic path wildcards like `{path}` (absolute path to script) and `{dir}` (parent folder).
- **Preset Dropdown:** Select from modular presets (like **Explorer (Open Folder)**) directly inside the Edit Dialog.

### 5. **Cloud Sync & Backups**
- Integration with **Convex cloud backend** for sync checking, backup creation, diff comparison, and configuration restorations.

---

## 🛠️ Installation & Setup

1. **Prerequisites:**
   - Python 3.10+
   - Install dependencies:
     ```bash
     pip install PyQt6
     ```

2. **Launch Application:**
   - Double-click or run from the shell:
     ```bash
     python script_manager_gui_qt.py
     ```

---

## ⚙️ Configuration File

All configurations, scripts, and grid profiles are saved locally in:
- `script_launcher_config.json`
