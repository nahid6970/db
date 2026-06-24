console.log('🔍 sidebar-handler.js loaded!');

let sidebarButtons = [];

function formatClickTrackingBadge(lastClickedAt) {
  const timestamp = Number(lastClickedAt || 0);
  if (!timestamp) {
    return {
      text: '0',
      title: 'Never clicked yet'
    };
  }

  const hours = Math.floor((Date.now() - timestamp) / (60 * 60 * 1000));
  const safeHours = Math.max(0, hours);
  return {
    text: `${safeHours}`,
    title: `Last clicked ${safeHours} hour${safeHours === 1 ? '' : 's'} ago`
  };
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'just now';
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return 'just now';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
  }
  return `${minutes}m ago`;
}

async function initializeSidebarYouTubeTrackingForUrl(url, existingChannelId) {
  const trackingState = {
    youtube_channel_id: undefined,
    youtube_last_video_id: undefined,
    youtube_new_video_count: 0,
  };

  let channelId = existingChannelId;

  if (!channelId) {
    const lookup = await window.convexClient.action("actions:fetchPageTitle", { url });
    channelId = lookup.youtubeChannelId || undefined;
  }

  if (!channelId) {
    return trackingState;
  }

  trackingState.youtube_channel_id = channelId;

  try {
    const baseline = await window.convexAction("actions:checkYouTubeUpdates", {
      channelId,
    });
    if (baseline.latestVideoId) {
      trackingState.youtube_last_video_id = baseline.latestVideoId;
    }
  } catch (error) {
    console.error('Error getting sidebar YouTube baseline video:', error);
  }

  return trackingState;
}

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
  if (!window._sidebarClickTrackingTimer) {
    window._sidebarClickTrackingTimer = setInterval(() => {
      if (sidebarButtons.some((button) => button.click_tracking_enabled)) {
        renderSidebarButtons();
      }
    }, 10 * 60 * 1000);
  }
  initNotificationBadges();
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
  btn.href = window.resolveRuntimeUrl ? window.resolveRuntimeUrl(button.url) : button.url;
  btn.target = '_blank';
  btn.className = 'sidebar-button add-button';
  btn.title = button.name;
  btn.dataset.dbId = button._id;

  // Enable dragging in edit mode
  if (window.editMode) {
    btn.draggable = true;
    btn.addEventListener("dragstart", handleSidebarDragStart);
    btn.addEventListener("dragover", handleSidebarDragOver);
    btn.addEventListener("dragleave", (e) => {
      btn.classList.remove('drag-over-before', 'drag-over-after');
    });
    btn.addEventListener("drop", handleSidebarDrop);
    btn.addEventListener("dragend", handleSidebarDragEnd);
  }

  // Apply custom CSS variables for dynamic styling
  btn.style.setProperty('--custom-text-color', button.text_color);
  btn.style.setProperty('--custom-bg-color', button.bg_color);
  btn.style.setProperty('--custom-hover-color', button.hover_color);
  btn.style.setProperty('--custom-border-color', button.border_color);
  btn.style.setProperty('--custom-border-radius', button.border_radius);
  btn.style.setProperty('--custom-font-size', button.font_size);

  // Tracking badge rendering
  if (button.click_tracking_enabled) {
    const clickBadge = document.createElement('span');
    clickBadge.className = 'link-badge-count click-tracking-badge';
    const badge = formatClickTrackingBadge(button.click_tracking_last_clicked_at);
    clickBadge.textContent = badge.text;
    clickBadge.style.bottom = '-5px';
    clickBadge.style.left = '-5px';
    clickBadge.title = badge.title;
    btn.appendChild(clickBadge);
  } else if (button.youtube_new_video_count && button.youtube_new_video_count > 0) {
    const youtubeBadge = document.createElement('span');
    youtubeBadge.className = 'link-badge-count';
    youtubeBadge.textContent = button.youtube_new_video_count;
    youtubeBadge.style.bottom = '-5px';
    youtubeBadge.style.left = '-5px';
    const timeAgoStr = button.youtube_notification_started_at 
      ? ` (first update ${formatTimeAgo(button.youtube_notification_started_at)})` 
      : '';
    youtubeBadge.title = `${button.youtube_new_video_count} new video${button.youtube_new_video_count > 1 ? 's' : ''}${timeAgoStr}`;
    btn.appendChild(youtubeBadge);
  } else if (button.youtube_channel_id) {
    const enabledBadge = document.createElement('span');
    enabledBadge.className = 'link-badge-dot youtube-enabled-badge';
    enabledBadge.style.bottom = '-5px';
    enabledBadge.style.left = '-5px';
    btn.appendChild(enabledBadge);
  }

  // Apply inline styles
  btn.style.color = button.text_color;
  btn.style.backgroundColor = button.bg_color;
  btn.style.borderColor = button.border_color;
  btn.style.borderRadius = button.border_radius;
  btn.style.fontSize = button.font_size;

  // Content based on display type
  if (button.display_type === 'image' && button.img_src) {
    const img = document.createElement('img');
    img.src = window.resolveRuntimeUrl ? window.resolveRuntimeUrl(button.img_src) : button.img_src;
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

  // Handle click to open URL
  btn.onclick = async (e) => {
    if (window.editMode) return; // Don't open link in edit mode
    e.preventDefault();

    // Handle notification button click
    if (button.has_notification) {
      handleNotificationButtonClick(button);
      return;
    }
    
    if (button.click_tracking_enabled) {
      try {
        await window.convexMutation("functions:updateYouTubeStatus", {
          id: button._id,
          table: "sidebar_buttons",
          click_tracking_enabled: true,
          click_tracking_last_clicked_at: Date.now(),
        });
        button.click_tracking_last_clicked_at = Date.now();
        renderSidebarButtons(); // Re-render to clear badge
      } catch (error) {
        console.error('Error updating click tracking (sidebar):', error);
      }
    } else if (button.youtube_new_video_count && button.youtube_new_video_count > 0) {
      try {
        await window.convexMutation("functions:updateYouTubeStatus", {
          id: button._id,
          table: "sidebar_buttons",
          youtube_new_video_count: 0,
          youtube_notification_started_at: 0
        });
        button.youtube_new_video_count = 0;
        button.youtube_notification_started_at = 0;
        renderSidebarButtons(); // Re-render to clear badge
      } catch (error) {
        console.error('Error resetting YouTube count (sidebar):', error);
      }
    }
    
    handleUrlOpening(button.url);
  };

  // Helper for clipboard with fallback
  function copyToClipboard(text, successMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        window.showNotification(successMsg, 'info');
      }).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      window.showNotification(successMsg, 'info');
    } catch (err) {
      window.showNotification('Copy failed (Please copy manually)', 'error');
    }
    document.body.removeChild(textArea);
  }

  async function handleUrlOpening(url) {
    if (!url) return;

    const hostedProjectUrl = window.getHostedProjectUrl?.(url);
    if (hostedProjectUrl) {
      window.open(hostedProjectUrl, '_blank');
      return;
    }
    
    if (url.startsWith('chrome://') || url.startsWith('edge://')) {
      copyToClipboard(url, 'URL copied! (Paste in new tab to open)');
    } else if (url.startsWith('file:///')) {
      // Convert file:///C:/path to openfile:C:\path
      const path = url.replace('file:///', '').replace(/\//g, '\\');
      window.location.href = 'openfile:' + path;
    } else {
      window.open(url, '_blank');
    }
  }

  // Add context menu for right-click
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const items = [
      {
        label: 'Edit',
        icon: '✏️',
        className: 'context-menu-edit',
        action: () => openEditSidebarButtonPopup(button, index)
      },
      {
        label: 'Duplicate',
        icon: '📋',
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
            click_tracking_enabled: button.click_tracking_enabled || false,
            click_tracking_last_clicked_at: button.click_tracking_last_clicked_at || 0,
            youtube_channel_id: button.youtube_channel_id || undefined,
            youtube_last_video_id: button.youtube_last_video_id || undefined,
            youtube_new_video_count: button.youtube_new_video_count || 0,
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
        icon: '🗑️',
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
    const editControls = document.createElement('div');
    editControls.className = 'item-edit-controls';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '';
    editBtn.title = 'Edit Sidebar Button';
    editBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditSidebarButtonPopup(button, index);
    };
    editControls.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '';
    delBtn.title = 'Delete Sidebar Button';
    delBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteSidebarButton(button._id);
    };
    editControls.appendChild(delBtn);
    
    btn.appendChild(editControls);
  }

  // Wrap in container with badge if has_notification
  if (button.has_notification) {
    const container = document.createElement('div');
    container.className = 'notification-button-container';
    const badge = document.createElement('span');
    badge.id = `${button.id}-notification-badge`;
    badge.className = 'notification-badge zero';
    badge.textContent = '0';
    container.appendChild(btn);
    container.appendChild(badge);
    return container;
  }

  return btn;
}


// Fetch and update notification badge for a button
function updateButtonNotifications(button) {
  if (!button.notification_api) return;
  fetch(button.notification_api)
    .then(r => r.json())
    .then(data => {
      const count = data.unseen_count || 0;
      const badge = document.getElementById(`${button.id}-notification-badge`);
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('zero');
      } else {
        badge.textContent = '0';
        badge.classList.add('zero');
      }
    })
    .catch(err => console.error(`Notification fetch error for ${button.name}:`, err));
}

// Handle click on a notification button
function handleNotificationButtonClick(button) {
  const badge = document.getElementById(`${button.id}-notification-badge`);
  const count = badge ? parseInt(badge.textContent) || 0 : 0;

  if (count === 0) {
    window.open(button.url, '_blank');
    return;
  }

  if (button.mark_seen_api && confirm(`Mark all ${count} items as seen?`)) {
    fetch(button.mark_seen_api, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          updateButtonNotifications(button);
          window.open(button.url, '_blank');
        } else {
          alert('Failed to mark items as seen');
        }
      })
      .catch(() => alert('Error marking items as seen'));
  } else {
    window.open(button.url, '_blank');
  }
}

// Poll notifications for all notification buttons after render
function initNotificationBadges() {
  sidebarButtons.forEach(button => {
    if (button.has_notification) updateButtonNotifications(button);
  });
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
  const imgInput = document.getElementById('sidebar-button-img-src-container');
  const svgInput = document.getElementById('sidebar-button-svg-code');

  iconInput.style.display = e.target.value === 'icon' ? 'block' : 'none';
  imgInput.style.display = e.target.value === 'image' ? 'flex' : 'none';
  svgInput.style.display = e.target.value === 'svg' ? 'block' : 'none';
});

document.getElementById('sidebar-button-youtube-tracking').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.getElementById('sidebar-button-click-tracking').checked = false;
  }
});

document.getElementById('sidebar-button-click-tracking').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.getElementById('sidebar-button-youtube-tracking').checked = false;
  }
});

document.getElementById('sidebar-button-notification').addEventListener('change', (e) => {
  document.getElementById('add-notification-settings').style.display = e.target.checked ? 'flex' : 'none';
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
    has_notification: document.getElementById('sidebar-button-notification').checked,
    notification_api: document.getElementById('sidebar-button-notification-api').value || '',
    mark_seen_api: document.getElementById('sidebar-button-mark-seen-api').value || '',
  };

  const youtubeTrackingEnabled = document.getElementById('sidebar-button-youtube-tracking').checked;
  const clickTrackingEnabled = document.getElementById('sidebar-button-click-tracking').checked;

  if (clickTrackingEnabled) {
    newButton.click_tracking_enabled = true;
    newButton.click_tracking_last_clicked_at = Date.now();
    newButton.youtube_channel_id = undefined;
    newButton.youtube_last_video_id = undefined;
    newButton.youtube_new_video_count = 0;
  } else if (youtubeTrackingEnabled) {
    try {
      const trackingState = await initializeSidebarYouTubeTrackingForUrl(newButton.url);
      if (trackingState.youtube_channel_id) {
        newButton.youtube_channel_id = trackingState.youtube_channel_id;
        newButton.youtube_last_video_id = trackingState.youtube_last_video_id || "";
        newButton.youtube_new_video_count = 0;
      } else {
        newButton.youtube_channel_id = undefined;
        newButton.youtube_last_video_id = undefined;
        newButton.youtube_new_video_count = 0;
      }
    } catch (error) {
      console.error('Error initializing sidebar YouTube tracking:', error);
      newButton.youtube_channel_id = undefined;
      newButton.youtube_last_video_id = undefined;
      newButton.youtube_new_video_count = 0;
    }
  }

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

  document.getElementById('edit-sidebar-button-youtube-tracking').checked = !!button.youtube_channel_id;
  document.getElementById('edit-sidebar-button-click-tracking').checked = !!button.click_tracking_enabled;

  const hasNotif = !!button.has_notification;
  document.getElementById('edit-sidebar-button-notification').checked = hasNotif;
  document.getElementById('edit-notification-settings').style.display = hasNotif ? 'flex' : 'none';
  document.getElementById('edit-sidebar-button-notification-api').value = button.notification_api || '';
  document.getElementById('edit-sidebar-button-mark-seen-api').value = button.mark_seen_api || '';

  const iconInput = document.getElementById('edit-sidebar-button-icon');
  const imgInput = document.getElementById('edit-sidebar-button-img-src-container');
  const svgInput = document.getElementById('edit-sidebar-button-svg-code');

  iconInput.style.display = button.display_type === 'icon' ? 'block' : 'none';
  imgInput.style.display = button.display_type === 'image' ? 'flex' : 'none';
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
  const imgInput = document.getElementById('edit-sidebar-button-img-src-container');
  const svgInput = document.getElementById('edit-sidebar-button-svg-code');

  iconInput.style.display = e.target.value === 'icon' ? 'block' : 'none';
  imgInput.style.display = e.target.value === 'image' ? 'flex' : 'none';
  svgInput.style.display = e.target.value === 'svg' ? 'block' : 'none';
});

document.getElementById('edit-sidebar-button-youtube-tracking').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.getElementById('edit-sidebar-button-click-tracking').checked = false;
  }
});

document.getElementById('edit-sidebar-button-click-tracking').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.getElementById('edit-sidebar-button-youtube-tracking').checked = false;
  }
});

document.getElementById('edit-sidebar-button-notification').addEventListener('change', (e) => {
  document.getElementById('edit-notification-settings').style.display = e.target.checked ? 'flex' : 'none';
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
    has_notification: document.getElementById('edit-sidebar-button-notification').checked,
    notification_api: document.getElementById('edit-sidebar-button-notification-api').value || '',
    mark_seen_api: document.getElementById('edit-sidebar-button-mark-seen-api').value || '',
  };

  const youtubeTrackingEnabled = document.getElementById('edit-sidebar-button-youtube-tracking').checked;
  const clickTrackingEnabled = document.getElementById('edit-sidebar-button-click-tracking').checked;

  if (clickTrackingEnabled) {
    updatedButton.click_tracking_enabled = true;
    updatedButton.click_tracking_last_clicked_at = button.click_tracking_enabled ? (button.click_tracking_last_clicked_at || Date.now()) : Date.now();
    updatedButton.youtube_channel_id = undefined;
    updatedButton.youtube_last_video_id = undefined;
    updatedButton.youtube_new_video_count = 0;
  } else if (youtubeTrackingEnabled) {
    try {
      const existingChannelId = button.youtube_channel_id || undefined;
      const trackingState = await initializeSidebarYouTubeTrackingForUrl(updatedButton.url, existingChannelId);
      if (trackingState.youtube_channel_id) {
        updatedButton.youtube_channel_id = trackingState.youtube_channel_id;
        updatedButton.youtube_last_video_id = trackingState.youtube_last_video_id || "";
        updatedButton.youtube_new_video_count = button.youtube_new_video_count || 0;
        updatedButton.youtube_notification_started_at = button.youtube_notification_started_at || undefined;
      } else {
        updatedButton.youtube_channel_id = undefined;
        updatedButton.youtube_last_video_id = undefined;
        updatedButton.youtube_new_video_count = 0;
        updatedButton.youtube_notification_started_at = undefined;
      }
    } catch (error) {
      console.error('Error initializing sidebar YouTube tracking during save:', error);
      updatedButton.youtube_channel_id = undefined;
      updatedButton.youtube_last_video_id = undefined;
      updatedButton.youtube_new_video_count = 0;
      updatedButton.youtube_notification_started_at = undefined;
    }
  } else {
    updatedButton.click_tracking_enabled = false;
    updatedButton.click_tracking_last_clicked_at = 0;
    updatedButton.youtube_channel_id = undefined;
    updatedButton.youtube_last_video_id = undefined;
    updatedButton.youtube_new_video_count = 0;
  }

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

// Drag and drop for sidebar
let draggedSidebarBtn = null;

function handleSidebarDragStart(e) {
  draggedSidebarBtn = e.currentTarget;
  draggedSidebarBtn.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleSidebarDragOver(e) {
  if (!draggedSidebarBtn) return; // Only sidebar buttons react
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if (target !== draggedSidebarBtn && target.classList.contains('sidebar-button')) {
    const rect = target.getBoundingClientRect();
    const isBefore = e.clientX < rect.left + rect.width / 2;
    
    target.classList.remove('drag-over-before', 'drag-over-after');
    if (isBefore) {
      target.classList.add('drag-over-before');
    } else {
      target.classList.add('drag-over-after');
    }
  }
}

function handleSidebarDrop(e) {
  if (!draggedSidebarBtn) return;
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget;
  const isBefore = target.classList.contains('drag-over-before');
  target.classList.remove('drag-over-before', 'drag-over-after');

  if (draggedSidebarBtn && draggedSidebarBtn !== target) {
    if (isBefore) {
      target.parentNode.insertBefore(draggedSidebarBtn, target);
    } else {
      target.parentNode.insertBefore(draggedSidebarBtn, target.nextSibling);
    }

    // Save new order
    setTimeout(() => saveSidebarOrder(), 300);
  }
}

function handleSidebarDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.sidebar-button.drag-over-before, .sidebar-button.drag-over-after').forEach(el => {
    el.classList.remove('drag-over-before', 'drag-over-after');
  });
  draggedSidebarBtn = null;
}

async function saveSidebarOrder() {
  try {
    const container = document.getElementById('sidebar-buttons-container');
    const allBtns = Array.from(container.children).filter(c => c.classList.contains('sidebar-button'));
    
    const order = allBtns.map((btn, index) => {
      const dbId = btn.dataset.dbId;
      const button = sidebarButtons.find(b => b._id === dbId);
      return {
        id: button ? button.id : dbId,
        order: index
      };
    });

    await window.convexMutation("functions:updateSidebarOrder", { order });
    console.log('✅ Sidebar order saved');
    // Refresh local state
    await loadSidebarButtons();
  } catch (error) {
    console.error('❌ Error saving sidebar order:', error);
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
