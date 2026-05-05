# Edit Menu Components

Reusable UI components from the myhome-convex edit popup system. Copy the CSS and HTML patterns into any project.

---

## Popup Container & Menu Card

**HTML structure:**
```html
<div class="popup-container hidden">
  <div class="Menu">
    <div class="popup-header">
      <h3>Title</h3>
      <span class="close-button">&times;</span>
    </div>
    <form>
      <!-- fields -->
      <button type="submit">Save</button>
    </form>
  </div>
</div>
```

**CSS:**
```css
.popup-container {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.popup-container.hidden { display: none; }
.hidden { display: none !important; }

.Menu {
  background: #31343a;
  padding: 20px;
  border-radius: 8px;
  border: 2px solid #555;
  min-width: 500px;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.popup-header h3 { margin: 0; color: #4CAF50; }

.close-button { font-size: 24px; cursor: pointer; color: #fff; }
.close-button:hover { color: #f44336; }
```

---

## Type Chip (Radio Group)

Styled radio buttons as clickable chips. Selected chip turns green.

**HTML:**
```html
<div class="type-picker-block">
  <div class="type-picker-row">

    <label class="type-chip">
      <input type="radio" name="my-type" value="text" checked>
      <span class="type-chip-body">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14v2H5zm0 4h9v2H5zm0 4h14v2H5z" fill="currentColor"/>
        </svg>
        <span>Text</span>
      </span>
    </label>

    <label class="type-chip">
      <input type="radio" name="my-type" value="image">
      <span class="type-chip-body">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm0 2v10h14V7zm2 8 3-4 2 3 3-4 4 5zM9 10.5A1.5 1.5 0 1010.5 9 1.5 1.5 0 009 10.5z" fill="currentColor"/>
        </svg>
        <span>Image</span>
      </span>
    </label>

  </div>
</div>
```

**CSS:**
```css
.type-picker-block { display: flex; flex-direction: column; gap: 0; }
.type-picker-row { display: flex; flex-wrap: wrap; gap: 10px; }

.type-chip { position: relative; display: block; margin: 0; }
.type-chip input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }

.type-chip-body {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 92px;
  padding: 10px 12px;
  border: 1px solid #50555d;
  border-radius: 10px;
  background: #24282e;
  color: #dbe2ea;
  cursor: pointer;
  transition: all 0.2s ease;
}
.type-chip-body svg { width: 18px; height: 18px; flex: 0 0 18px; }
.type-chip:hover .type-chip-body { border-color: #6a7380; background: #2b3138; }
.type-chip input[type="radio"]:checked + .type-chip-body {
  border-color: #4caf50;
  background: #203325;
  color: #effff0;
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.25);
}
.type-chip input[type="radio"]:focus-visible + .type-chip-body {
  outline: 2px solid #7cc8ff;
  outline-offset: 2px;
}
```

---

## Option Chip (Checkbox Toggle)

Styled checkboxes as toggleable chips. Checked chip turns green.

**HTML:**
```html
<div class="option-chip-row">

  <label class="option-chip">
    <input type="checkbox" id="my-hidden">
    <span class="option-chip-body">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5c5.5 0 9.5 5.4 10.5 7-1 1.6-5 7-10.5 7S2.5 13.6 1.5 12C2.5 10.4 6.5 5 12 5zm0 2C8.3 7 5.2 10.2 3.9 12 5.2 13.8 8.3 17 12 17s6.8-3.2 8.1-5C18.8 10.2 15.7 7 12 7zm0 2.5A2.5 2.5 0 1112 14.5 2.5 2.5 0 0112 9.5z" fill="currentColor"/>
      </svg>
      <span>Hide</span>
    </span>
  </label>

  <label class="option-chip">
    <input type="checkbox" id="my-new-line">
    <span class="option-chip-body">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h10v2H4zm0 5h10v2H4zm0 5h6v2H4zm11-8 5 4-5 4v-3h-4v-2h4z" fill="currentColor"/>
      </svg>
      <span>New Line</span>
    </span>
  </label>

  <label class="option-chip">
    <input type="checkbox" id="my-password">
    <span class="option-chip-body">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1a5 5 0 015 5v2h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 015-5zm0 2a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3zm0 9a2 2 0 110 4 2 2 0 010-4z" fill="currentColor"/>
      </svg>
      <span>Password</span>
    </span>
  </label>

  <label class="option-chip">
    <input type="checkbox" id="my-autofit">
    <span class="option-chip-body">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 4h-4v2h6v-6h-2z" fill="currentColor"/>
      </svg>
      <span>Auto Fit</span>
    </span>
  </label>

</div>
```

**CSS:**
```css
.option-chip-row { display: flex; flex-wrap: wrap; gap: 10px; }

.option-chip { position: relative; display: block; margin: 0; }
.option-chip input[type="checkbox"] { position: absolute; opacity: 0; pointer-events: none; }

.option-chip-body {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #50555d;
  border-radius: 10px;
  background: #24282e;
  color: #dbe2ea;
  cursor: pointer;
  transition: all 0.2s ease;
}
.option-chip-body svg { width: 18px; height: 18px; flex: 0 0 18px; }
.option-chip:hover .option-chip-body { border-color: #6a7380; background: #2b3138; }
.option-chip input[type="checkbox"]:checked + .option-chip-body {
  border-color: #4caf50;
  background: #203325;
  color: #effff0;
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.25);
}
.option-chip input[type="checkbox"]:focus-visible + .option-chip-body {
  outline: 2px solid #7cc8ff;
  outline-offset: 2px;
}
```

---

## Compact Size Row

4 small inputs in a row (for width, height, font size, etc.).

**HTML:**
```html
<div class="compact-size-row">
  <input type="text" placeholder="Width" style="flex:1;">
  <input type="text" placeholder="Height" style="flex:1;">
  <input type="text" placeholder="Font" style="flex:1;">
  <input type="text" placeholder="Size" style="flex:1;">
</div>
```

**CSS:**
```css
.compact-size-row { display: flex; gap: 8px; }
.compact-size-row input {
  flex: 1 1 0;
  min-width: 0;
  max-width: 110px;
  padding-left: 7px;
  padding-right: 7px;
  font-size: 13px;
}
```

---

## Color Input with Live Preview

Input that shows its typed color as background with contrast text.

**HTML:**
```html
<input type="text" class="color-input" placeholder="Background">
```

**JS (apply on `input` event):**
```js
function applyColorPreview(input) {
  const value = input.value.trim();
  if (!value) {
    input.style.backgroundColor = '';
    input.style.color = '';
    return;
  }
  const test = document.createElement('div');
  test.style.color = value;
  document.body.appendChild(test);
  const computed = getComputedStyle(test).color;
  document.body.removeChild(test);
  if (!computed || computed === 'rgba(0, 0, 0, 0)') return;
  input.style.backgroundColor = value;
  // Contrast text
  const m = computed.match(/\d+/g);
  if (m) {
    const brightness = (parseInt(m[0]) * 299 + parseInt(m[1]) * 587 + parseInt(m[2]) * 114) / 1000;
    input.style.color = brightness > 128 ? '#000' : '#fff';
  }
}
document.querySelectorAll('.color-input').forEach(el => {
  el.addEventListener('input', () => applyColorPreview(el));
});
```

---

## Group Input with Dropdown Picker

Text input with a ▼ button that shows a dropdown of existing options.

**HTML:**
```html
<div class="group-input-container">
  <input type="text" id="my-group" placeholder="Group">
  <button type="button" class="group-picker-btn" onclick="toggleGroupPicker(event, 'my-group')">▼</button>
</div>
```

**CSS:**
```css
.group-input-container { position: relative; display: flex; align-items: center; flex: 1; }
.group-input-container input { width: 100% !important; padding-right: 30px !important; }
.group-picker-btn {
  position: absolute;
  right: 5px;
  background: none !important;
  border: none !important;
  color: #888 !important;
  cursor: pointer;
  padding: 5px !important;
}
```

---

## URL Input Group

URL field with + button to add more.

**HTML:**
```html
<div id="urls-container">
  <div class="url-input-group">
    <input type="url" class="url-input" placeholder="URL" required>
    <button type="button" onclick="addUrlField()">+</button>
  </div>
</div>
```

**CSS:**
```css
.url-input-group { display: flex; gap: 5px; margin-bottom: 5px; }
.url-input-group input { flex: 1; }
```

---

## SVG Icon Reference

Common SVGs used in chips:

| Name | SVG path |
|------|----------|
| Hide/Eye | `M12 5c5.5 0 9.5 5.4 10.5 7-1 1.6-5 7-10.5 7S2.5 13.6 1.5 12C2.5 10.4 6.5 5 12 5zm0 2C8.3 7 5.2 10.2 3.9 12 5.2 13.8 8.3 17 12 17s6.8-3.2 8.1-5C18.8 10.2 15.7 7 12 7zm0 2.5A2.5 2.5 0 1112 14.5 2.5 2.5 0 0112 9.5z` |
| New Line | `M4 6h10v2H4zm0 5h10v2H4zm0 5h6v2H4zm11-8 5 4-5 4v-3h-4v-2h4z` |
| Password/Lock | `M12 1a5 5 0 015 5v2h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 015-5zm0 2a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3zm0 9a2 2 0 110 4 2 2 0 010-4z` |
| Auto Fit | `M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 4h-4v2h6v-6h-2z` |
| Text | `M5 7h14v2H5zm0 4h9v2H5zm0 4h14v2H5z` |
| Image | `M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm0 2v10h14V7zm2 8 3-4 2 3 3-4 4 5zM9 10.5A1.5 1.5 0 1010.5 9 1.5 1.5 0 009 10.5z` |
| SVG/Code | `M4 6h16v12H4zm2 2v8h12V8zm2 6 2-4 2 3 2-2 2 3H8z` |
| NerdFont | `M6 5h2v14H6zm10 0h2v14h-2zM9.5 7h5a2.5 2.5 0 010 5h-5zm0 7h8v2h-8z` |
| Normal Group | `M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z` |
| Top Group | `M3 3h18v5H3zm0 8h8v10H3zm10 0h8v5h-8zm0 7h8v3h-8z` |
| Box Group | `M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z` |
| Flex layout | `M3 5h4v14H3zm6 0h4v14H9zm6 0h6v14h-6z` |
| List layout | `M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zM3 17h2v2H3zm4 0h14v2H7z` |

All SVGs use `viewBox="0 0 24 24"` and `fill="currentColor"`.

---

## Base Form Inputs CSS

```css
input, textarea, select {
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #555;
  padding: 8px;
  border-radius: 4px;
}
input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: #4CAF50;
}
form { display: flex; flex-direction: column; gap: 10px; }
button[type="submit"] {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}
button[type="button"] {
  background: #2196F3;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
}
```
