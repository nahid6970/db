console.log('🔍 sidebar-handler.js loaded!');

let sidebarButtons = [];

// Initialize helper functions if not available
if (!window.showNotification) {
  window.showNotification = (message, type = 'success') => {
    const notif = document.getElementById('copy-notification');
    if (notif) {
      notif.textContent = message;
      notif.className = `copy-notification ${type} show`;
      setTimeout(() => notif.classList.remove('show'), 2000);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };
}

// Load sidebar buttons
async function loadSidebarButtons() {
  console.log('🔵 loadSidebarButtons() called');
  try {
    // Wait for both convexClient and convexQuery to be available
    if (!window.convexClient || !window.convexQuery) {
      console.warn('Waiting for Convex client to initialize...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window.convexClient && window.convexQuery) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 10000);
      });
    }
    
    if (!window.convexClient) {
      console.error('❌ Convex client still not available after timeout');
      return;
    }
    
    console.log('🔵 Calling convexQuery for sidebar buttons...');
    const data = await window.convexQuery("functions:getSidebarButtons");
    sidebarButtons = data;
    console.log('🔵 Loaded sidebar buttons:', sidebarButtons.length);
  } catch (error) {
    console.error('Error loading sidebar buttons:', error);
  }
  renderSidebarButtons();
}

// Render sidebar buttons
function renderSidebarButtons() {
  console.log('🔵 renderSidebarButtons() called, buttons count:', sidebarButtons.length);
  const container = document.getElementById('sidebar-buttons-container');
  if (!container) {
    console.error('❌ Container #sidebar-buttons-container not found!');
    return;
  }
  console.log('✅ Container found');
  container.innerHTML = '';

  sidebarButtons.forEach((button, index) => {
    const btn = createSidebarButton(button, index);
    container.appendChild(btn);
  });

  // Add button (always visible)
  const addBtn = document.createElement('a');
  addBtn.href = '#';
  addBtn.className = 'add-button';
  addBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  addBtn.title = 'Add Button';
  addBtn.onclick = (e) => {
    e.preventDefault();
    showAddSidebarButtonPopup();
  };
  container.appendChild(addBtn);
}

// Create sidebar button
// Create sidebar button
function createSidebarButton(button, index) {
  const btn = document.createElement('a');
  btn.href = button.url;
  btn.target = '_blank';
  btn.className = 'sidebar-button add-button';
  btn.title = button.name;

  // Apply custom CSS variables for dynamic styling
  btn.style.setProperty('--custom-text-color', button.text_color);
  btn.style.setProperty('--custom-bg-color', button.bg_color);
  btn.style.setProperty('--custom-hover-color', button.hover_color);
  btn.style.setProperty('--custom-border-color', button.border_color);
  btn.style.setProperty('--custom-border-radius', button.border_radius);
  btn.style.setProperty('--custom-font-size', button.font_size);

  // Apply inline styles
  btn.style.color = button.text_color;
  btn.style.backgroundColor = button.bg_color;
  btn.style.borderColor = button.border_color;
  btn.style.borderRadius = button.border_radius;
  btn.style.fontSize = button.font_size;

  // Content based on display type
  if (button.display_type === 'image' && button.img_src) {
    const img = document.createElement('img');
    img.src = button.img_src;
    img.style.width = '25px';
    img.style.height = '25px';
    btn.appendChild(img);
  } else if (button.display_type === 'svg' && button.svg_code) {
    const temp = document.createElement('div');
    temp.innerHTML = button.svg_code;
    const svg = temp.querySelector('svg');
    if (svg) {
      svg.style.width = '25px';
      svg.style.height = '25px';
      svg.style.fill = button.text_color;
      btn.appendChild(svg);
    } else {
      btn.innerHTML = button.svg_code;
    }
  } else {
    const icon = document.createElement('i');
    icon.className = button.icon_class || 'nf nf-fa-question';
    icon.style.fontFamily = 'jetbrainsmono nfp, monospace';
    icon.style.fontSize = button.font_size;
    icon.style.display = 'inline-block';
    btn.appendChild(icon);
  }

  // Hover effect
  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = button.hover_color;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = button.bg_color;
  });

  // Add context menu for right-click
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const items = [
      {
        label: 'Edit',
        className: 'context-menu-edit',
        action: () => openEditSidebarButtonPopup(button, index)
      },
      {
        label: 'Duplicate',
        className: 'context-menu-copy',
        action: async () => {
          const duplicatedButton = {
            name: button.name + ' (Copy)',
            url: button.url,
            display_type: button.display_type,
            icon_class: button.icon_class || '',
            img_src: button.img_src || '',
            svg_code: button.svg_code || '',
            text_color: button.text_color,
            bg_color: button.bg_color,
            hover_color: button.hover_color,
            border_color: button.border_color,
            border_radius: button.border_radius,
            font_size: button.font_size,
            has_notification: button.has_notification || false,
            notification_api: button.notification_api || '',
            mark_seen_api: button.mark_seen_api || '',
            id: button.id || ''
          };
          try {
            await window.convexMutation("functions:addSidebarButton", duplicatedButton);
            await loadSidebarButtons();
            window.showNotification('Button duplicated!', 'success');
          } catch (error) {
            console.error('Error duplicating button:', error);
            window.showNotification('Error duplicating button', 'error');
          }
        }
      },
      {
        label: 'Delete',
        className: 'context-menu-delete',
        action: () => {
          if (confirm(`Delete "${button.name}"?`)) {
            deleteSidebarButton(button._id);
          }
        }
      }
    ];

    if (typeof window.showContextMenu === 'function') {
      window.showContextMenu(e, items);
    }
  });

  // Edit mode buttons
  if (window.editMode) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏';
    editBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditSidebarButtonPopup(button, index);
    };
    btn.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '🗑';
    delBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteSidebarButton(button._id);
    };
    btn.appendChild(delBtn);
  }

  return btn;
}


// Add sidebar button popup
function showAddSidebarButtonPopup() {
  document.getElementById('add-sidebar-button-popup').classList.remove('hidden');
  document.getElementById('add-sidebar-button-form').reset();
  
  // Apply color preview to all color fields
  setTimeout(() => {
    if (typeof applyColorPreviewToContainer === 'function') {
      applyColorPreviewToContainer(document.getElementById('add-sidebar-button-popup'));
    }
  }, 50);
}

document.getElementById('sidebar-button-display-type').addEventListener('change', (e) => {
  const iconInput = document.getElementById('sidebar-button-icon');
  const imgInput = document.getElementById('sidebar-button-img-src');
  const svgInput = document.getElementById('sidebar-button-svg-code');

  iconInput.style.display = e.target.value === 'icon' ? 'block' : 'none';
  imgInput.style.display = e.target.value === 'image' ? 'block' : 'none';
  svgInput.style.display = e.target.value === 'svg' ? 'block' : 'none';
});

document.getElementById('add-sidebar-button-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const newButton = {
    id: `btn-${Date.now()}`,
    name: document.getElementById('sidebar-button-name').value,
    url: document.getElementById('sidebar-button-url').value,
    display_type: document.getElementById('sidebar-button-display-type').value,
    icon_class: document.getElementById('sidebar-button-icon').value,
    img_src: document.getElementById('sidebar-button-img-src').value,
    svg_code: document.getElementById('sidebar-button-svg-code').value,
    text_color: document.getElementById('sidebar-button-text-color').value || '#000',
    bg_color: document.getElementById('sidebar-button-bg-color').value || '#fff',
    hover_color: document.getElementById('sidebar-button-hover-color').value || '#e0e0e0',
    border_color: document.getElementById('sidebar-button-border-color').value || '#ccc',
    border_radius: document.getElementById('sidebar-button-border-radius').value || '4px',
    font_size: document.getElementById('sidebar-button-font-size').value || '16px',
    has_notification: false
  };

  try {
    await window.convexMutation("functions:addSidebarButton", newButton);
    document.getElementById('add-sidebar-button-popup').classList.add('hidden');
    await loadSidebarButtons();
    window.showNotification('Button added!');
  } catch (error) {
    console.error('Error adding button:', error);
    alert('Error adding button: ' + error.message);
  }
});

// Edit sidebar button popup
function openEditSidebarButtonPopup(button, index) {
  document.getElementById('edit-sidebar-button-id').value = button._id;
  document.getElementById('edit-sidebar-button-name').value = button.name;
  document.getElementById('edit-sidebar-button-url').value = button.url;
  document.getElementById('edit-sidebar-button-display-type').value = button.display_type;
  document.getElementById('edit-sidebar-button-icon').value = button.icon_class || '';
  document.getElementById('edit-sidebar-button-img-src').value = button.img_src || '';
  document.getElementById('edit-sidebar-button-svg-code').value = button.svg_code || '';
  document.getElementById('edit-sidebar-button-text-color').value = button.text_color;
  document.getElementById('edit-sidebar-button-bg-color').value = button.bg_color;
  document.getElementById('edit-sidebar-button-hover-color').value = button.hover_color;
  document.getElementById('edit-sidebar-button-border-color').value = button.border_color;
  document.getElementById('edit-sidebar-button-border-radius').value = button.border_radius;
  document.getElementById('edit-sidebar-button-font-size').value = button.font_size;

  const iconInput = document.getElementById('edit-sidebar-button-icon');
  const imgInput = document.getElementById('edit-sidebar-button-img-src');
  const svgInput = document.getElementById('edit-sidebar-button-svg-code');

  iconInput.style.display = button.display_type === 'icon' ? 'block' : 'none';
  imgInput.style.display = button.display_type === 'image' ? 'block' : 'none';
  svgInput.style.display = button.display_type === 'svg' ? 'block' : 'none';

  document.getElementById('edit-sidebar-button-popup').classList.remove('hidden');
  
  // Apply color preview to all color fields
  setTimeout(() => {
    if (typeof applyColorPreviewToContainer === 'function') {
      applyColorPreviewToContainer(document.getElementById('edit-sidebar-button-popup'));
    }
  }, 50);
}

document.getElementById('edit-sidebar-button-display-type').addEventListener('change', (e) => {
  const iconInput = document.getElementById('edit-sidebar-button-icon');
  const imgInput = document.getElementById('edit-sidebar-button-img-src');
  const svgInput = document.getElementById('edit-sidebar-button-svg-code');

  iconInput.style.display = e.target.value === 'icon' ? 'block' : 'none';
  imgInput.style.display = e.target.value === 'image' ? 'block' : 'none';
  svgInput.style.display = e.target.value === 'svg' ? 'block' : 'none';
});

document.getElementById('edit-sidebar-button-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const dbId = document.getElementById('edit-sidebar-button-id').value;
  const button = sidebarButtons.find(b => b._id === dbId);

  const updatedButton = {
    dbId,
    id: button.id,
    name: document.getElementById('edit-sidebar-button-name').value,
    url: document.getElementById('edit-sidebar-button-url').value,
    display_type: document.getElementById('edit-sidebar-button-display-type').value,
    icon_class: document.getElementById('edit-sidebar-button-icon').value,
    img_src: document.getElementById('edit-sidebar-button-img-src').value,
    svg_code: document.getElementById('edit-sidebar-button-svg-code').value,
    text_color: document.getElementById('edit-sidebar-button-text-color').value,
    bg_color: document.getElementById('edit-sidebar-button-bg-color').value,
    hover_color: document.getElementById('edit-sidebar-button-hover-color').value,
    border_color: document.getElementById('edit-sidebar-button-border-color').value,
    border_radius: document.getElementById('edit-sidebar-button-border-radius').value,
    font_size: document.getElementById('edit-sidebar-button-font-size').value,
    has_notification: button.has_notification || false
  };

  try {
    await window.convexMutation("functions:updateSidebarButton", updatedButton);
    document.getElementById('edit-sidebar-button-popup').classList.add('hidden');
    await loadSidebarButtons();
    window.showNotification('Button updated!');
  } catch (error) {
    console.error('Error updating button:', error);
    alert('Error updating button: ' + error.message);
  }
});

// Delete sidebar button
async function deleteSidebarButton(id) {
  if (!confirm('Delete this button?')) return;

  try {
    await window.convexMutation("functions:deleteSidebarButton", { id });
    await loadSidebarButtons();
    window.showNotification('Button deleted!');
  } catch (error) {
    console.error('Error deleting button:', error);
    alert('Error deleting button: ' + error.message);
  }
}

// Edit mode listener
document.addEventListener('editModeChanged', loadSidebarButtons);

window.loadSidebarButtons = loadSidebarButtons;
window.openEditSidebarButtonPopup = openEditSidebarButtonPopup;
window.deleteSidebarButton = deleteSidebarButton;

// Fallback initialization if app.js fails
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔵 DOMContentLoaded fired in sidebar-handler.js');
  
  // Always try to load sidebar buttons
  if (typeof loadSidebarButtons === 'function') {
    console.log('🔵 Calling loadSidebarButtons...');
    loadSidebarButtons();
  }
  
  // Also set up a fallback timer
  setTimeout(() => {
    console.log('🔵 Fallback timer: checking if sidebar buttons loaded...');
    const container = document.getElementById('sidebar-buttons-container');
    if (container && container.children.length === 0) {
      console.warn('⚠️ No sidebar buttons rendered, trying again...');
      loadSidebarButtons();
    }
  }, 2000);
});
