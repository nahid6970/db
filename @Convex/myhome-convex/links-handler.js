console.log('🔍 links-handler.js loaded!');

let links = [];
let draggedElement = null;

// Initialize edit mode
if (typeof window.editMode === 'undefined') {
  window.editMode = false;
}

// F1 key toggle edit mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    e.preventDefault();
    window.editMode = !window.editMode;
    console.log('🔵 Edit mode toggled:', window.editMode);
    
    const container = document.querySelector('.flex-container2');
    if (container) {
      container.classList.toggle('edit-mode', window.editMode);
    }
    
    // Dispatch event for other handlers
    document.dispatchEvent(new CustomEvent('editModeChanged', { 
      detail: { isEditMode: window.editMode } 
    }));
    
    // Re-render to show/hide edit buttons
    renderLinks();
    if (typeof loadSidebarButtons === 'function') {
      loadSidebarButtons();
    }
    
    // Show notification
    window.showNotification(
      window.editMode ? 'Edit mode enabled (F1 to disable)' : 'Edit mode disabled',
      'success'
    );
  }
});

// Initialize Convex client if not already initialized
if (!window.convexClient) {
  console.log('🔵 Initializing Convex client in links-handler.js...');
  
  // Load ConvexHttpClient dynamically
  import('https://esm.sh/convex@1.16.0/browser').then(module => {
    const { ConvexHttpClient } = module;
    window.convexClient = new ConvexHttpClient("https://lovable-wildcat-595.convex.cloud");
    console.log('✅ Convex client initialized!');
    
    // Now load links
    if (typeof loadLinks === 'function') {
      loadLinks();
    }
  }).catch(error => {
    console.error('❌ Failed to load Convex client:', error);
  });
}

// Helper functions for Convex API calls
if (!window.convexQuery) {
  window.convexQuery = async (functionName, args = {}) => {
    if (!window.convexClient) {
      throw new Error('Convex client not initialized');
    }
    return await window.convexClient.query(functionName, args);
  };
}

if (!window.convexMutation) {
  window.convexMutation = async (functionName, args = {}) => {
    if (!window.convexClient) {
      throw new Error('Convex client not initialized');
    }
    return await window.convexClient.mutation(functionName, args);
  };
}

// Show notification helper
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

// Load links from Convex
async function loadLinks() {
  try {
    // Wait for convexQuery to be available
    if (!window.convexQuery) {
      console.warn('Waiting for Convex client to initialize...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window.convexQuery) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
    
    const data = await window.convexQuery("functions:getLinks");
    links = data.sort((a, b) => (a._creationTime || 0) - (b._creationTime || 0));
  } catch (error) {
    console.error('Error loading links:', error);
  }
  renderLinks();
  refreshOpenPopup();

}
// Refresh popup if it's open
function refreshOpenPopup() {
  const popup = document.getElementById('group_type_box-popup');
  if (!popup || popup.classList.contains('hidden')) return;
  
  const popupTitle = popup.querySelector('h3');
  if (!popupTitle || !popupTitle.dataset.groupName) return;
  
  const groupName = popupTitle.dataset.groupName;
  const groupLinks = links.filter(l => (l.group || 'Ungrouped') === groupName);
  
  const popupContent = popup.querySelector('.popup-content-inner');
  popupContent.innerHTML = '';
  
  groupLinks.forEach((link) => {
    const linkIndex = links.findIndex(l => l._id === link._id);
    const clonedItem = createLinkItem(link, linkIndex);
    popupContent.appendChild(clonedItem);
  });
}

// Show group picker context menu
window.toggleGroupPicker = function(event, inputId) {
  event.preventDefault();
  event.stopPropagation();
  
  const input = document.getElementById(inputId);
  if (!input) return;
  
  // Get unique group names from links
  const groups = [...new Set(links.map(link => link.group || 'Ungrouped'))];
  groups.sort((a, b) => a.localeCompare(b));
  
  // Create menu items
  const items = groups.map(group => ({
    label: group,
    action: () => {
      input.value = group;
      // Trigger input event for any listeners
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }));
  
  // Show context menu at the button's position
  if (typeof window.showContextMenu === 'function') {
    window.showContextMenu(event, items);
  }
};

// Render links
function renderLinks() {
  const container = document.getElementById('links-container');
  
  if (!container) {
    console.error('❌ links-container not found!');
    return;
  }
  
  container.innerHTML = '';

  const grouped = {};
  const collapsible = {};
  const separators = [];

  links.forEach((link, index) => {
    if (link.hidden && !window.editMode) return;

    // Handle separators - store them separately
    if (link.is_separator) {
      separators.push({ link, index });
      return;
    }

    const group = link.group || 'Ungrouped';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({ link, index });

    if (link.collapsible) collapsible[group] = true;
  });

  // Sort groups by group_order
  const sortedGroupNames = Object.keys(grouped).sort((a, b) => {
    const aOrder = grouped[a][0].link.group_order ?? 999;
    const bOrder = grouped[b][0].link.group_order ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });

  if (Object.keys(collapsible).length > 0) {
    const topContainer = document.createElement('div');
    topContainer.className = 'group_type_top-container';

    sortedGroupNames.filter(name => collapsible[name]).forEach(groupName => {
      const groupDiv = createCollapsibleGroup(groupName, grouped[groupName]);
      topContainer.appendChild(groupDiv);
    });

    container.appendChild(topContainer);
  }

  // Render regular groups with separators
  console.log('🔵 Rendering regular groups...');
  sortedGroupNames.forEach(groupName => {
    if (collapsible[groupName]) return;

    // Check if there's a separator before this group
    const separator = separators.find(s => s.link.group === groupName);
    if (separator) {
      const sepDiv = document.createElement('div');
      sepDiv.className = 'group-separator';
      sepDiv.dataset.linkIndex = separator.index;
      
      if (window.editMode) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'separator-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove separator';
        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          await window.convexMutation('functions:deleteLink', { id: separator.link._id });
          await loadLinks();
        };
        sepDiv.appendChild(deleteBtn);
      }
      
      container.appendChild(sepDiv);
    }

    const groupDiv = createRegularGroup(groupName, grouped[groupName]);
    container.appendChild(groupDiv);
  });

  // Only add floating action button (FAB) - removed the large button
  console.log('🟢 Creating floating action button (FAB)...');
  let fab = document.getElementById('fab-add-link');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'fab-add-link';
    fab.innerHTML = '+';
    fab.title = 'Add New Link';
    fab.style.position = 'fixed';
    fab.style.bottom = '30px';
    fab.style.right = '30px';
    fab.style.width = '60px';
    fab.style.height = '60px';
    fab.style.borderRadius = '50%';
    fab.style.background = '#4CAF50';
    fab.style.color = 'white';
    fab.style.border = 'none';
    fab.style.fontSize = '32px';
    fab.style.cursor = 'pointer';
    fab.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    fab.style.zIndex = '1000';
    fab.style.display = 'flex';
    fab.style.alignItems = 'center';
    fab.style.justifyContent = 'center';
    fab.onclick = () => {
      console.log('🟢 FAB clicked!');
      showAddLinkPopup();
    };
    fab.onmouseenter = () => {
      fab.style.background = '#45a049';
      fab.style.transform = 'scale(1.1)';
    };
    fab.onmouseleave = () => {
      fab.style.background = '#4CAF50';
      fab.style.transform = 'scale(1)';
    };
    document.body.appendChild(fab);
    console.log('✅ Floating action button (FAB) added!');
    console.log('✅ FAB element:', fab);
    console.log('✅ FAB in DOM:', document.getElementById('fab-add-link'));
  }
  
  console.log('✅ renderLinks() completed!');
}

// Create collapsible group
function createCollapsibleGroup(groupName, items) {
  const div = document.createElement('div');
  div.className = 'group_type_top';
  div.dataset.groupName = groupName;
  div.draggable = true;

  const firstLink = items[0].link;
  const displayName = firstLink.top_name || groupName;

  const header = document.createElement('div');
  header.className = 'group_type_top-header';

  const title = document.createElement('h4');
  title.className = 'group_type_top-title';
  renderDisplayName(title, displayName);


  header.appendChild(title);

  if (window.editMode) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '⚙';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openEditGroupPopup(groupName);
    };
    header.appendChild(editBtn);
  }


  const content = document.createElement('ul');
  content.className = 'group_type_top-content';

  items.forEach(({ link, index }) => {
    const item = createLinkItem(link, index);
    content.appendChild(item);
  });

  div.appendChild(header);
  div.appendChild(content);
  
  // Drag and drop
  div.addEventListener("dragstart", handleGroupDragStart);
  div.addEventListener("dragover", handleGroupDragOver);
  div.addEventListener("drop", handleGroupDrop);
  div.addEventListener("dragend", handleGroupDragEnd);

  // Apply styling
  if (firstLink.top_bg_color) div.style.backgroundColor = firstLink.top_bg_color;
  if (firstLink.top_text_color) title.style.color = firstLink.top_text_color;
  if (firstLink.top_border_color) div.style.borderColor = firstLink.top_border_color;

  div.onclick = (e) => {
    if (e.target === header || e.target === title) {
      if (firstLink.password_protect) {
        const pwd = prompt('Enter password:');
        if (pwd !== '1823') {
          alert('Incorrect password!');
          return;
        }
      }
      div.classList.toggle('expanded');
      
      // Open popup instead of expanding
      const popup = document.getElementById('group_type_box-popup');
      const popupBox = popup.querySelector('.group_type_box');
      const popupContent = popup.querySelector('.popup-content-inner');
      popupContent.innerHTML = '';

      // Update popup title
      const popupTitle = popupBox.querySelector('h3');
      if (popupTitle) {
        renderDisplayName(popupTitle, displayName);
        popupTitle.dataset.groupName = groupName;
      }

      // Clone all link items into popup
      items.forEach(({ link, index }) => {
        const clonedItem = createLinkItem(link, index);
        popupContent.appendChild(clonedItem);
      });

      // Apply group styling to popup
      if (firstLink.popup_bg_color) popupBox.style.backgroundColor = firstLink.popup_bg_color;
      if (firstLink.popup_text_color) popupBox.style.color = firstLink.popup_text_color;
      if (firstLink.popup_border_color) popupBox.style.borderColor = firstLink.popup_border_color;
      if (firstLink.popup_border_radius) popupBox.style.borderRadius = firstLink.popup_border_radius;

      popup.classList.remove('hidden');
    }
  };

  // Context menu
  div.addEventListener('contextmenu', (e) => {
    showContextMenu(e, [
      { label: 'Edit', action: () => openEditGroupPopup(groupName) },
      { label: 'Add Separator', action: () => addSeparator(groupName) },
      { label: 'Duplicate', action: () => duplicateGroup(groupName) },
      { label: 'Delete', action: () => deleteGroup(groupName) }
    ]);
  });

  return div;
}

// Create regular group
function createRegularGroup(groupName, items) {
  const div = document.createElement('div');
  div.className = 'link-group';
  div.dataset.groupName = groupName;

  const firstLink = items[0].link;
  const isHorizontal = firstLink.horizontal_stack;

  const isBoxGroup = firstLink.box_group;

  // Box group - compact button that opens popup
  if (isBoxGroup) {
    div.classList.add('group_type_box');
    div.draggable = true;
    
    const header = document.createElement('div');
    header.className = 'group-header-container';
    
    const title = document.createElement('h3');
    title.className = 'group-title';
    const displayName = firstLink.top_name || groupName;
    renderDisplayName(title, displayName);
    
    header.appendChild(title);
    
    if (window.editMode) {
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '⚙';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openEditGroupPopup(groupName);
      };
      header.appendChild(editBtn);
    }
    
    div.appendChild(header);
    
    // Apply styling
    if (firstLink.horizontal_bg_color) div.style.backgroundColor = firstLink.horizontal_bg_color;
    if (firstLink.horizontal_text_color) div.style.color = firstLink.horizontal_text_color;
    if (firstLink.horizontal_border_color) div.style.borderColor = firstLink.horizontal_border_color;
    
    // Apply hover color
    if (firstLink.horizontal_hover_color) {
      div.addEventListener('mouseenter', () => div.style.backgroundColor = firstLink.horizontal_hover_color);
      div.addEventListener('mouseleave', () => div.style.backgroundColor = firstLink.horizontal_bg_color || '#2d2d2d');
    }
    
    // Click handler - opens popup
    div.onclick = (e) => {
      if (firstLink.password_protect) {
        const pwd = prompt('Enter password:');
        if (pwd !== '1823') {
          alert('Incorrect password!');
          return;
        }
      }
      
      const popup = document.getElementById('group_type_box-popup');
      const popupBox = popup.querySelector('.group_type_box');
      const popupContent = popup.querySelector('.popup-content-inner');
      popupContent.innerHTML = '';

      const popupTitle = popupBox.querySelector('h3');
      if (popupTitle) {
        renderDisplayName(popupTitle, displayName);
        popupTitle.dataset.groupName = groupName;
      }

      items.forEach(({ link, index }) => {
        const clonedItem = createLinkItem(link, index);
        popupContent.appendChild(clonedItem);
      });

      if (firstLink.popup_bg_color) popupBox.style.backgroundColor = firstLink.popup_bg_color;
      if (firstLink.popup_text_color) popupBox.style.color = firstLink.popup_text_color;
      if (firstLink.popup_border_color) popupBox.style.borderColor = firstLink.popup_border_color;
      if (firstLink.popup_border_radius) popupBox.style.borderRadius = firstLink.popup_border_radius;

      popup.classList.remove('hidden');
    };
    
    div.addEventListener('contextmenu', (e) => {
      showContextMenu(e, [
        { label: 'Edit', action: () => openEditGroupPopup(groupName) },
        { label: 'Add Separator', action: () => addSeparator(groupName) },
        { label: 'Duplicate', action: () => duplicateGroup(groupName) },
        { label: 'Delete', action: () => deleteGroup(groupName) }
      ]);
    });
    
    // Drag and drop
    div.addEventListener("dragstart", handleGroupDragStart);
    div.addEventListener("dragover", handleGroupDragOver);
    div.addEventListener("drop", handleGroupDrop);
    div.addEventListener("dragend", handleGroupDragEnd);
    
    return div;
  }

  // Regular group
  div.draggable = true;

  const title = document.createElement('h3');
  title.textContent = groupName;
  div.appendChild(title);

  if (window.editMode) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit Group';
    editBtn.onclick = () => openEditGroupPopup(groupName);
    div.appendChild(editBtn);
  }

  const ul = document.createElement('ul');
  if (isHorizontal) ul.className = 'horizontal-stack-group';

  const displayStyle = firstLink.display_style || 'flex';
  if (displayStyle === 'list-item') div.classList.add('list-style');
  
  // Apply horizontal stack styling
  if (isHorizontal) {
    if (firstLink.horizontal_bg_color) div.style.backgroundColor = firstLink.horizontal_bg_color;
    if (firstLink.horizontal_text_color) title.style.color = firstLink.horizontal_text_color;
    if (firstLink.horizontal_border_color) div.style.borderColor = firstLink.horizontal_border_color;
    
    if (firstLink.horizontal_hover_color) {
      div.addEventListener("mouseenter", () => div.style.backgroundColor = firstLink.horizontal_hover_color);
      div.addEventListener("mouseleave", () => div.style.backgroundColor = firstLink.horizontal_bg_color || "");
    }
  }

  items.forEach(({ link, index }) => {
    const item = createLinkItem(link, index);
    ul.appendChild(item);
  });

  div.appendChild(ul);

  // Context menu
  div.addEventListener('contextmenu', (e) => {
    if (e.target === div || e.target === title) {
      showContextMenu(e, [
        { label: 'Edit', action: () => openEditGroupPopup(groupName) },
        { label: 'Add Separator', action: () => addSeparator(groupName) },
        { label: 'Duplicate', action: () => duplicateGroup(groupName) },
        { label: 'Delete', action: () => deleteGroup(groupName) }
      ]);
    }
  });
  
  // Drag and drop
  div.addEventListener("dragstart", handleGroupDragStart);
  div.addEventListener("dragover", handleGroupDragOver);
  div.addEventListener("drop", handleGroupDrop);
  div.addEventListener("dragend", handleGroupDragEnd);

  return div;
}

// Create link item
function createLinkItem(link, index) {
  const li = document.createElement('li');
  li.className = 'link-item';
  li.dataset.linkIndex = index;
  li.draggable = true;

  if (link.hidden) li.classList.add('hidden-item');

  const a = document.createElement('a');
  a.href = link.url;
  a.target = '_blank';
  a.title = link.title || link.name || '';

  // Render content based on type
  if (link.default_type === 'nerd-font' && link.icon_class) {
    const icon = document.createElement('i');
    icon.className = link.icon_class;
    icon.style.fontFamily = 'jetbrainsmono nfp, monospace';
    icon.style.fontSize = link.font_size || '24px';
    icon.style.display = 'inline-block';
    a.appendChild(icon);
  } else if (link.default_type === 'img' && link.img_src) {
    const img = document.createElement('img');
    img.src = link.img_src;
    img.width = link.width || 50;
    img.height = link.height || 50;
    a.appendChild(img);
  } else if (link.default_type === 'svg' && link.svg_code) {
    const temp = document.createElement('div');
    temp.innerHTML = link.svg_code;
    const svg = temp.querySelector('svg');
    if (svg) {
      if (!svg.style.width && link.width) svg.style.width = link.width;
      if (!svg.style.height && link.height) svg.style.height = link.height;
      if (!svg.style.width) svg.style.width = '50px';
      if (!svg.style.height) svg.style.height = '50px';
      svg.style.fill = link.color || 'currentColor';
      a.appendChild(svg);
    } else {
      a.innerHTML = link.svg_code;
    }
  } else {
    a.textContent = link.text || link.name || 'Link';
  }

  // Apply styling
  if (link.color) a.style.color = link.color;
  if (link.background_color) a.style.backgroundColor = link.background_color;
  if (link.font_family) a.style.fontFamily = link.font_family;
  if (link.font_size) a.style.fontSize = link.font_size;
  if (link.width) a.style.width = link.width;
  if (link.height) a.style.height = link.height;
  if (link.border_radius) a.style.borderRadius = link.border_radius;

  if (link.li_bg_color) li.style.backgroundColor = link.li_bg_color;
  if (link.li_border_color) li.style.borderColor = link.li_border_color;
  if (link.li_border_radius) li.style.borderRadius = link.li_border_radius;
  if (link.li_width) li.style.minWidth = link.li_width;
  if (link.li_height) li.style.minHeight = link.li_height;

  if (link.li_hover_color) {
    li.addEventListener('mouseenter', () => li.style.backgroundColor = link.li_hover_color);
    li.addEventListener('mouseleave', () => li.style.backgroundColor = link.li_bg_color || '');
  }

  // Handle multiple URLs
  a.onclick = (e) => {
    if (link.urls && link.urls.length > 1) {
      e.preventDefault();
      window.open(link.urls[0], '_blank');
    }
  };

  li.appendChild(a);

  // Edit buttons
  if (window.editMode) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏';
    editBtn.onclick = (e) => {
      e.preventDefault();
      openEditLinkPopup(link, index);
    };
    li.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '🗑';
    delBtn.onclick = (e) => {
      e.preventDefault();
      deleteLink(link._id);
    };
    li.appendChild(delBtn);
  }

  // Context menu
  li.addEventListener('contextmenu', (e) => {
    showContextMenu(e, [
      { label: 'New-Tab', action: () => window.open(link.url, '_blank') },
      { label: 'Edit', action: () => openEditLinkPopup(link, index) },
      { label: 'Copy', action: () => copyLink(link) },
      { label: 'Delete', action: () => deleteLink(link._id) }
    ]);
  });

  // Drag and drop
  li.addEventListener('dragstart', (e) => {
    draggedElement = li;
    li.classList.add('dragging');
  });

  li.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  li.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (draggedElement && draggedElement !== li) {
      const fromIndex = parseInt(draggedElement.dataset.linkIndex);
      const toIndex = parseInt(li.dataset.linkIndex);
      await reorderLinks(fromIndex, toIndex);
    }
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    draggedElement = null;
  });

  return li;
}

// Render display name (text, icon, or SVG)
function renderDisplayName(element, name) {
  element.innerHTML = '';

  if (name.startsWith('nf nf-')) {
    const icon = document.createElement('i');
    icon.className = name;
    element.appendChild(icon);
  } else if (name.startsWith('<svg')) {
    const temp = document.createElement('div');
    temp.innerHTML = name;
    const svg = temp.querySelector('svg');
    if (svg) {
      if (!svg.style.width) svg.style.width = '1em';
      if (!svg.style.height) svg.style.height = '1em';
      svg.style.display = 'inline-block';
      svg.style.verticalAlign = 'middle';
      svg.style.fill = 'currentColor';
      element.appendChild(svg);
    } else {
      element.textContent = name;
    }
  } else {
    element.textContent = name;
  }
}

// Add link popup
function showAddLinkPopup() {
  document.getElementById('quick-add-link-popup').classList.remove('hidden');
  document.getElementById('quick-add-link-form').reset();
}

// Add separator function
async function addSeparator(groupName) {
  try {
    await window.convexMutation('functions:addLink', {
      name: '---',
      group: groupName || '',
      is_separator: true,
      urls: [],
      url: '',
      default_type: 'separator'
    });
    await loadLinks();
  } catch (error) {
    console.error('Error adding separator:', error);
    alert('Failed to add separator');
  }
}

// Quick add link form handler
document.getElementById('quick-add-link-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = document.getElementById('quick-link-url').value;
  const group = document.getElementById('quick-link-group').value;

  try {
    // Extract domain from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    // Get favicon using Google's service
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    
    // Fetch page title
    let pageTitle = domain;
    try {
      const result = await window.convexClient.action("actions:fetchPageTitle", { url });
      pageTitle = result.title;
    } catch (error) {
      console.warn('Could not fetch page title, using domain:', error);
    }
    
    const newLink = {
      name: pageTitle,
      group: group || 'Ungrouped',
      urls: [url],
      url: url,
      default_type: 'img',
      img_src: faviconUrl,
      text: '',
      icon_class: '',
      svg_code: '',
      width: '',
      height: '',
      color: '',
      background_color: '',
      font_family: '',
      font_size: '',
      li_width: '',
      li_height: '',
      li_bg_color: '',
      li_hover_color: '',
      li_border_color: '',
      li_border_radius: '',
      border_radius: '',
      title: pageTitle,
      hidden: false
    };

    await window.convexMutation("functions:addLink", newLink);
    document.getElementById('quick-add-link-popup').classList.add('hidden');
    await loadLinks();
    window.showNotification('Link added!');
  } catch (error) {
    console.error('Error adding link:', error);
    alert('Error adding link: ' + error.message);
  }
});


document.getElementById('add-link-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const urls = getAllUrls(false);
  const typeRadios = document.querySelectorAll('input[name="link-type"]');
  let defaultType = 'text';
  typeRadios.forEach(r => { if (r.checked) defaultType = r.value; });

  const newLink = {
    name: document.getElementById('link-name').value,
    group: document.getElementById('link-group').value,
    urls,
    url: urls[0],
    default_type: defaultType,
    text: document.getElementById('link-text').value,
    icon_class: document.getElementById('link-icon-class').value,
    img_src: document.getElementById('link-img-src').value,
    svg_code: document.getElementById('link-svg-code').value,
    width: document.getElementById('link-width').value,
    height: document.getElementById('link-height').value,
    color: document.getElementById('link-color').value,
    background_color: document.getElementById('link-background-color').value,
    font_family: document.getElementById('link-font-family').value,
    font_size: document.getElementById('link-font-size').value,
    li_width: document.getElementById('link-li-width').value,
    li_height: document.getElementById('link-li-height').value,
    li_bg_color: document.getElementById('link-li-bg-color').value,
    li_hover_color: document.getElementById('link-li-hover-color').value,
    li_border_color: document.getElementById('link-li-border-color').value,
    li_border_radius: document.getElementById('link-li-border-radius').value,
    border_radius: document.getElementById('link-border-radius').value,
    title: document.getElementById('link-title').value,
    hidden: document.getElementById('link-hidden').checked
  };

  try {
    await window.convexMutation("functions:addLink", newLink);
    document.getElementById('add-link-popup').classList.add('hidden');
    await loadLinks();
    window.showNotification('Link added!');
  } catch (error) {
    console.error('Error adding link:', error);
    alert('Error adding link: ' + error.message);
  }
});

// Edit link popup
function openEditLinkPopup(link, index) {
  document.getElementById('edit-link-id').value = link._id;
  document.getElementById('edit-link-name').value = link.name || '';
  document.getElementById('edit-link-group').value = link.group || '';

  // Populate URL fields
  populateUrlFields(link.urls || [link.url], true);

  document.getElementById('edit-link-text').value = link.text || '';
  document.getElementById('edit-link-icon-class').value = link.icon_class || '';
  document.getElementById('edit-link-img-src').value = link.img_src || '';
  document.getElementById('edit-link-svg-code').value = link.svg_code || '';
  document.getElementById('edit-link-width').value = link.width || '';
  document.getElementById('edit-link-height').value = link.height || '';
  document.getElementById('edit-link-color').value = link.color || '';
  document.getElementById('edit-link-background-color').value = link.background_color || '';
  document.getElementById('edit-link-font-family').value = link.font_family || '';
  document.getElementById('edit-link-font-size').value = link.font_size || '';
  document.getElementById('edit-link-li-width').value = link.li_width || '';
  document.getElementById('edit-link-li-height').value = link.li_height || '';
  document.getElementById('edit-link-li-bg-color').value = link.li_bg_color || '';
  document.getElementById('edit-link-li-hover-color').value = link.li_hover_color || '';
  document.getElementById('edit-link-li-border-color').value = link.li_border_color || '';
  document.getElementById('edit-link-li-border-radius').value = link.li_border_radius || '';
  document.getElementById('edit-link-border-radius').value = link.border_radius || '';
  document.getElementById('edit-link-title').value = link.title || '';
  document.getElementById('edit-link-hidden').checked = link.hidden || false;

  const typeRadios = document.querySelectorAll('input[name="edit-link-type"]');
  typeRadios.forEach(r => r.checked = r.value === link.default_type);

  const svgTextarea = document.getElementById('edit-link-svg-code');
  svgTextarea.style.display = link.default_type === 'svg' ? 'block' : 'none';

  document.getElementById('edit-link-popup').classList.remove('hidden');
  
  // Apply color preview to all color fields
  setTimeout(() => {
    if (typeof applyColorPreviewToContainer === 'function') {
      applyColorPreviewToContainer(document.getElementById('edit-link-popup'));
    }
  }, 50);
}

document.getElementById('edit-link-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('edit-link-id').value;
  const urls = getAllUrls(true);
  const typeRadios = document.querySelectorAll('input[name="edit-link-type"]');
  let defaultType = 'text';
  typeRadios.forEach(r => { if (r.checked) defaultType = r.value; });

  const updatedLink = {
    id,
    name: document.getElementById('edit-link-name').value,
    group: document.getElementById('edit-link-group').value,
    urls,
    url: urls[0],
    default_type: defaultType,
    text: document.getElementById('edit-link-text').value,
    icon_class: document.getElementById('edit-link-icon-class').value,
    img_src: document.getElementById('edit-link-img-src').value,
    svg_code: document.getElementById('edit-link-svg-code').value,
    width: document.getElementById('edit-link-width').value,
    height: document.getElementById('edit-link-height').value,
    color: document.getElementById('edit-link-color').value,
    background_color: document.getElementById('edit-link-background-color').value,
    font_family: document.getElementById('edit-link-font-family').value,
    font_size: document.getElementById('edit-link-font-size').value,
    li_width: document.getElementById('edit-link-li-width').value,
    li_height: document.getElementById('edit-link-li-height').value,
    li_bg_color: document.getElementById('edit-link-li-bg-color').value,
    li_hover_color: document.getElementById('edit-link-li-hover-color').value,
    li_border_color: document.getElementById('edit-link-li-border-color').value,
    li_border_radius: document.getElementById('edit-link-li-border-radius').value,
    border_radius: document.getElementById('edit-link-border-radius').value,
    title: document.getElementById('edit-link-title').value,
    hidden: document.getElementById('edit-link-hidden').checked
  };

  try {
    await window.convexMutation("functions:updateLink", updatedLink);
    document.getElementById('edit-link-popup').classList.add('hidden');
    await loadLinks();
    window.showNotification('Link updated!');
  } catch (error) {
    console.error('Error updating link:', error);
    alert('Error updating link: ' + error.message);
  }
});

// Delete link
async function deleteLink(id) {
  if (!confirm('Delete this link?')) return;

  try {
    await window.convexMutation("functions:deleteLink", { id });
    await loadLinks();
    window.showNotification('Link deleted!');
  } catch (error) {
    console.error('Error deleting link:', error);
    alert('Error deleting link: ' + error.message);
  }
}

// Copy link
async function copyLink(link) {
  const { _id, _creationTime, ...newLink } = link;
  newLink.name = (newLink.name || '') + ' (Copy)';

  try {
    await window.convexMutation("functions:addLink", newLink);
    await loadLinks();
    window.showNotification('Link copied!');
  } catch (error) {
    console.error('Error copying link:', error);
    alert('Error copying link: ' + error.message);
  }
}

// Reorder links
async function reorderLinks(fromIndex, toIndex) {
  const newLinks = [...links];
  const [moved] = newLinks.splice(fromIndex, 1);
  newLinks.splice(toIndex, 0, moved);

  try {
    await window.convexMutation("functions:updateAllLinks", { links: newLinks });
    await loadLinks();
  } catch (error) {
    console.error('Error reordering:', error);
    alert('Error reordering: ' + error.message);
  }
}

// Edit group popup
function openEditGroupPopup(groupName) {
  const groupLinks = links.filter(l => (l.group || 'Ungrouped') === groupName);
  const firstLink = groupLinks[0] || {};

  document.getElementById('edit-group-original-name').value = groupName;
  document.getElementById('edit-group-name').value = groupName;
  document.getElementById('edit-group-top-name').value = firstLink.top_name || '';
  document.getElementById('edit-group-password-protect').checked = firstLink.password_protect || false;

  // Set group type radio
  const typeRadios = document.querySelectorAll('input[name="edit-group-type"]');
  let groupType = 'horizontal';
  if (firstLink.collapsible) groupType = 'top';
  else if (firstLink.box_group) groupType = 'box';
  else if (firstLink.horizontal_stack) groupType = 'horizontal';
  typeRadios.forEach(r => r.checked = r.value === groupType);

  const displayRadios = document.querySelectorAll('input[name="edit-group-display"]');
  displayRadios.forEach(r => r.checked = r.value === (firstLink.display_style || 'flex'));

  document.getElementById('edit-group-top-bg-color').value = firstLink.top_bg_color || '';
  document.getElementById('edit-group-top-text-color').value = firstLink.top_text_color || '';
  document.getElementById('edit-group-top-border-color').value = firstLink.top_border_color || '';
  document.getElementById('edit-group-top-hover-color').value = firstLink.top_hover_color || '';
  document.getElementById('edit-group-top-width').value = firstLink.top_width || '';
  document.getElementById('edit-group-top-height').value = firstLink.top_height || '';
  document.getElementById('edit-group-top-font-family').value = firstLink.top_font_family || '';
  document.getElementById('edit-group-top-font-size').value = firstLink.top_font_size || '';
  document.getElementById('edit-group-popup-bg-color').value = firstLink.popup_bg_color || '';
  document.getElementById('edit-group-popup-text-color').value = firstLink.popup_text_color || '';
  document.getElementById('edit-group-popup-border-color').value = firstLink.popup_border_color || '';
  document.getElementById('edit-group-popup-border-radius').value = firstLink.popup_border_radius || '';
  document.getElementById('edit-group-horizontal-bg-color').value = firstLink.horizontal_bg_color || '';
  document.getElementById('edit-group-horizontal-text-color').value = firstLink.horizontal_text_color || '';
  document.getElementById('edit-group-horizontal-border-color').value = firstLink.horizontal_border_color || '';
  document.getElementById('edit-group-horizontal-hover-color').value = firstLink.horizontal_hover_color || '';

  document.getElementById('edit-group-popup').classList.remove('hidden');

  // Show/hide sections based on type
  updateGroupTypeSettings(groupType);
  
  // Apply color preview to all color fields
  setTimeout(() => {
    if (typeof applyColorPreviewToContainer === 'function') {
      applyColorPreviewToContainer(document.getElementById('edit-group-popup'));
    }
  }, 50);
}

function updateGroupTypeSettings(type) {
  // Show all settings for all types
  document.getElementById('collapsible-settings').style.display = 'block';
  document.getElementById('horizontal-settings').style.display = 'block';
}

document.querySelectorAll('input[name="edit-group-type"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    updateGroupTypeSettings(e.target.value);
  });
});

document.getElementById('edit-group-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const originalName = document.getElementById('edit-group-original-name').value;
  const newName = document.getElementById('edit-group-name').value;

  const displayRadios = document.querySelectorAll('input[name="edit-group-display"]');
  let displayStyle = 'flex';
  displayRadios.forEach(r => { if (r.checked) displayStyle = r.value; });

  // Get group type from radio buttons
  const typeRadios = document.querySelectorAll('input[name="edit-group-type"]');
  let groupType = 'horizontal';
  typeRadios.forEach(r => { if (r.checked) groupType = r.value; });

  const groupSettings = {
    collapsible: groupType === 'top',
    box_group: groupType === 'box',
    horizontal_stack: groupType === 'horizontal',
    display_style: displayStyle,
    password_protect: document.getElementById('edit-group-password-protect').checked,
    top_name: document.getElementById('edit-group-top-name').value,
    top_bg_color: document.getElementById('edit-group-top-bg-color').value,
    top_text_color: document.getElementById('edit-group-top-text-color').value,
    top_border_color: document.getElementById('edit-group-top-border-color').value,
    top_hover_color: document.getElementById('edit-group-top-hover-color').value,
    top_width: document.getElementById('edit-group-top-width').value,
    top_height: document.getElementById('edit-group-top-height').value,
    top_font_family: document.getElementById('edit-group-top-font-family').value,
    top_font_size: document.getElementById('edit-group-top-font-size').value,
    popup_bg_color: document.getElementById('edit-group-popup-bg-color').value,
    popup_text_color: document.getElementById('edit-group-popup-text-color').value,
    popup_border_color: document.getElementById('edit-group-popup-border-color').value,
    popup_border_radius: document.getElementById('edit-group-popup-border-radius').value,
    horizontal_bg_color: document.getElementById('edit-group-horizontal-bg-color').value,
    horizontal_text_color: document.getElementById('edit-group-horizontal-text-color').value,
    horizontal_border_color: document.getElementById('edit-group-horizontal-border-color').value,
    horizontal_hover_color: document.getElementById('edit-group-horizontal-hover-color').value
  };

  try {
    const updatedLinks = links.map(link => {
      if ((link.group || 'Ungrouped') === originalName) {
        return { ...link, group: newName, ...groupSettings };
      }
      return link;
    });

    await window.convexMutation("functions:updateAllLinks", { links: updatedLinks });
    document.getElementById('edit-group-popup').classList.add('hidden');
    await loadLinks();
    window.showNotification('Group updated!');
  } catch (error) {
    console.error('Error updating group:', error);
    alert('Error updating group: ' + error.message);
  }
});

// Delete group
async function deleteGroup(groupName) {
  if (!confirm(`Delete group "${groupName}" and all its links?`)) return;

  try {
    const remaining = links.filter(l => (l.group || 'Ungrouped') !== groupName);
    await window.convexMutation("functions:updateAllLinks", { links: remaining });
    await loadLinks();
    window.showNotification('Group deleted!');
  } catch (error) {
    console.error('Error deleting group:', error);
    alert('Error deleting group: ' + error.message);
  }
}

// Duplicate group
async function duplicateGroup(groupName) {
  const groupLinks = links.filter(l => (l.group || 'Ungrouped') === groupName);
  if (groupLinks.length === 0) return;

  const newGroupName = groupName + ' (Copy)';
  const duplicatedLinks = groupLinks.map(link => {
    const { _id, _creationTime, ...newLink } = link;
    newLink.group = newGroupName;
    return newLink;
  });

  try {
    for (const link of duplicatedLinks) {
      await window.convexMutation("functions:addLink", link);
    }
    await loadLinks();
    window.showNotification('Group duplicated!');
  } catch (error) {
    console.error('Error duplicating group:', error);
    alert('Error duplicating group: ' + error.message);
  }
}

// SVG textarea toggle
document.querySelectorAll('input[name="link-type"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.getElementById('link-svg-code').style.display = radio.value === 'svg' ? 'block' : 'none';
  });
});

document.querySelectorAll('input[name="edit-link-type"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.getElementById('edit-link-svg-code').style.display = radio.value === 'svg' ? 'block' : 'none';
  });
});

// URL field management
window.addUrlField = () => {
  const container = document.getElementById('urls-container');
  const group = document.createElement('div');
  group.className = 'url-input-group';

  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'url-input';
  input.placeholder = 'URL';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '−';
  removeBtn.onclick = () => group.remove();

  group.appendChild(input);
  group.appendChild(removeBtn);
  container.appendChild(group);
};

window.addEditUrlField = () => {
  const container = document.getElementById('edit-urls-container');
  const group = document.createElement('div');
  group.className = 'url-input-group';

  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'url-input';
  input.placeholder = 'URL';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '−';
  removeBtn.onclick = () => group.remove();

  group.appendChild(input);
  group.appendChild(removeBtn);
  container.appendChild(group);
};

function getAllUrls(isEdit = false) {
  const container = document.getElementById(isEdit ? 'edit-urls-container' : 'urls-container');
  const inputs = container.querySelectorAll('.url-input');
  return Array.from(inputs).map(input => input.value).filter(url => url.trim());
}

function populateUrlFields(urls, isEdit = false) {
  const container = document.getElementById(isEdit ? 'edit-urls-container' : 'urls-container');
  container.innerHTML = '';

  if (!urls || urls.length === 0) urls = [''];

  urls.forEach((url, index) => {
    const group = document.createElement('div');
    group.className = 'url-input-group';

    const input = document.createElement('input');
    input.type = 'url';
    input.className = 'url-input';
    input.placeholder = 'URL';
    input.value = url;
    if (index === 0) input.required = true;

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.onclick = isEdit ? window.addEditUrlField : window.addUrlField;

    group.appendChild(input);

    if (index > 0) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '−';
      removeBtn.onclick = () => group.remove();
      group.appendChild(removeBtn);
    } else {
      group.appendChild(addBtn);
    }

    container.appendChild(group);
  });
}

// Edit mode listener
document.addEventListener('editModeChanged', loadLinks);

window.loadLinks = loadLinks;
window.openEditLinkPopup = openEditLinkPopup;
window.openEditGroupPopup = openEditGroupPopup;
window.deleteLink = deleteLink;
window.deleteGroup = deleteGroup;
window.duplicateGroup = duplicateGroup;
window.copyLink = copyLink;
window.reorderLinks = reorderLinks;

// Fallback initialization if app.js fails
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔵 DOMContentLoaded fired in links-handler.js');
  
  if (!window.convexClient) {
    console.warn('Convex client not initialized (app.js failed?), running fallback...');
    loadLinks();
  }
  
  // EMERGENCY: Force create FAB after 2 seconds if it doesn't exist
  setTimeout(() => {
    console.log('🔵 Checking if FAB exists...');
    
    const fab = document.getElementById('fab-add-link');
    
    if (!fab) {
      console.warn('⚠️ FAB not found! Creating emergency FAB...');
      const emergencyFab = document.createElement('button');
      emergencyFab.id = 'fab-add-link';
      emergencyFab.innerHTML = '+';
      emergencyFab.title = 'Add New Link';
      emergencyFab.style.position = 'fixed';
      emergencyFab.style.bottom = '30px';
      emergencyFab.style.right = '30px';
      emergencyFab.style.width = '60px';
      emergencyFab.style.height = '60px';
      emergencyFab.style.borderRadius = '50%';
      emergencyFab.style.background = '#4CAF50';
      emergencyFab.style.color = 'white';
      emergencyFab.style.border = 'none';
      emergencyFab.style.fontSize = '32px';
      emergencyFab.style.cursor = 'pointer';
      emergencyFab.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
      emergencyFab.style.zIndex = '1000';
      emergencyFab.style.display = 'flex';
      emergencyFab.style.alignItems = 'center';
      emergencyFab.style.justifyContent = 'center';
      emergencyFab.onclick = () => showAddLinkPopup();
      document.body.appendChild(emergencyFab);
      console.log('✅ Emergency FAB created!');
    } else {
      console.log('✅ FAB exists!');
    }
  }, 2000);
});

// Group drag and drop
let draggedGroup = null;

function handleGroupDragStart(e) {
  draggedGroup = e.currentTarget;
  draggedGroup.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleGroupDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if (target !== draggedGroup && (target.classList.contains('group_type_top') || target.classList.contains('group_type_box') || target.classList.contains('link-group'))) {
    target.classList.add('drag-over');
  }
}

function handleGroupDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  
  if (draggedGroup && draggedGroup !== target) {
    const container = target.parentNode;
    const allGroups = Array.from(container.children);
    const draggedIndex = allGroups.indexOf(draggedGroup);
    const targetIndex = allGroups.indexOf(target);
    
    if (draggedIndex < targetIndex) {
      target.parentNode.insertBefore(draggedGroup, target.nextSibling);
    } else {
      target.parentNode.insertBefore(draggedGroup, target);
    }
    
    // Save new group order after DOM updates
    setTimeout(() => saveGroupOrder(), 300);
  }
}

function handleGroupDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  draggedGroup = null;
}

async function saveGroupOrder() {
  try {
    // Get all groups in their actual DOM order
    const container = document.getElementById('links-container');
    const allGroups = [];
    
    // Iterate through all children in order
    Array.from(container.children).forEach(child => {
      if (child.classList.contains('group_type_top-container')) {
        // Get all groups from inside top container (even if a regular group was dragged there)
        const innerGroups = Array.from(child.children).filter(c => c.dataset.groupName);
        allGroups.push(...innerGroups);
      } else if (child.dataset.groupName) {
        // Regular group, box group, or a top group dragged out
        allGroups.push(child);
      }
    });
    
    const groupOrder = allGroups.map((group, index) => ({
      name: group.dataset.groupName,
      order: index
    }));
    
    await window.convexMutation("functions:updateGroupOrder", { groupOrder });
    console.log('✅ Group order saved:', groupOrder.length, 'groups');
  } catch (error) {
    console.error('❌ Error saving group order:', error);
  }
}
