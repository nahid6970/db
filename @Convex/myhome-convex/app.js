import { ConvexHttpClient } from "https://esm.sh/convex@1.16.0/browser";
import { api } from "./convex/_generated/api.js";

const client = new ConvexHttpClient("https://lovable-wildcat-595.convex.cloud");

window.convexClient = client;
window.api = api;
window.editMode = false;

// Helper functions for queries and mutations
window.convexQuery = async (functionPath) => {
  const [module, funcName] = functionPath.split(':');
  return await client.query(api[module][funcName]);
};

window.convexMutation = async (functionPath, args) => {
  const [module, funcName] = functionPath.split(':');
  return await client.mutation(api[module][funcName], args);
};

// Notify that Convex is ready
console.log('✓ Convex client initialized');
window.convexReady = true;
window.dispatchEvent(new CustomEvent('convexReady'));

// F1 key toggle edit mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    e.preventDefault();
    toggleEditMode();
  }
});

// Toggle edit mode function
function toggleEditMode() {
  window.editMode = !window.editMode;
  document.querySelector('.flex-container2').classList.toggle('edit-mode', window.editMode);
  const toggleBtn = document.getElementById('edit-mode-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = window.editMode ? '✓ Edit' : '✏️ Edit';
    toggleBtn.classList.toggle('active', window.editMode);
  }
  document.dispatchEvent(new CustomEvent('editModeChanged', { detail: { isEditMode: window.editMode } }));
}

// Show notification
window.showNotification = (message, type = 'success') => {
  const notif = document.getElementById('copy-notification');
  notif.textContent = message;
  notif.className = `copy-notification ${type} show`;
  setTimeout(() => notif.classList.remove('show'), 2000);
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing Convex app...');
  console.log('Convex client:', window.convexClient);
  console.log('API:', window.api);
  
  // Setup edit mode toggle button
  const toggleBtn = document.getElementById('edit-mode-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleEditMode);
    console.log('✅ Edit mode toggle button set up');
  }
  
  // Setup close button handlers with logging
  console.log('🔧 Setting up close button handlers...');
  const closeButtons = document.querySelectorAll('.close-button');
  console.log('Found', closeButtons.length, 'close buttons');
  
  closeButtons.forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      console.log('❌ Close button', index, 'clicked');
      e.stopPropagation();
      const popup = btn.closest('.popup-container');
      if (popup) {
        popup.classList.add('hidden');
        console.log('✅ Popup closed');
      }
    });
  });
  
  // Close popup when clicking outside (on the backdrop)
  document.querySelectorAll('.popup-container').forEach((popup, index) => {
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        console.log('🖱️ Clicked outside popup', index, ', closing');
        popup.classList.add('hidden');
      }
    });
  });
  
  console.log('✅ Close handlers set up');
  
  // Load data
  try {
    if (typeof loadLinks === 'function') {
      console.log('📦 Loading links...');
      await loadLinks();
    }
    if (typeof loadSidebarButtons === 'function') {
      console.log('📦 Loading sidebar buttons...');
      await loadSidebarButtons();
    }
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }
  
  setupColorPreview();
});

// Color preview system
function setupColorPreview() {
  // Use event delegation for dynamically added inputs
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('color-input') || 
        e.target.placeholder?.toLowerCase().includes('color') ||
        e.target.placeholder?.toLowerCase().includes('bg') ||
        e.target.placeholder?.toLowerCase().includes('hover')) {
      applyColorPreview(e.target);
    }
  });
  
  // Apply to existing inputs on page load
  const applyToExisting = () => {
    document.querySelectorAll('.color-input, input[placeholder*="olor"], input[placeholder*="Color"], input[placeholder*="BG"], input[placeholder*="Hover"]').forEach(input => {
      if (input.value) {
        applyColorPreview(input);
      }
    });
  };
  
  applyToExisting();
  
  // Re-apply when popups are opened
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.classList.contains('popup-container') && !target.classList.contains('hidden')) {
          setTimeout(applyToExisting, 100);
        }
      }
    });
  });
  
  document.querySelectorAll('.popup-container').forEach(popup => {
    observer.observe(popup, { attributes: true });
  });
}

function applyColorPreview(input) {
  const value = input.value.trim();
  if (!value) {
    input.style.setProperty('background-color', '', 'important');
    input.style.setProperty('color', '', 'important');
    input.classList.remove('color-preview');
    return;
  }
  
  // Test if valid color
  const test = document.createElement('div');
  test.style.color = value;
  if (test.style.color || value.match(/^#[0-9A-Fa-f]{3,6}$/)) {
    input.style.setProperty('background-color', value, 'important');
    input.style.setProperty('color', getContrastColor(value), 'important');
    input.classList.add('color-preview');
  } else {
    input.style.setProperty('background-color', '', 'important');
    input.style.setProperty('color', '', 'important');
    input.classList.remove('color-preview');
  }
}

function getContrastColor(color) {
  let r, g, b;
  
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else {
    const test = document.createElement('div');
    test.style.color = color;
    document.body.appendChild(test);
    const computed = window.getComputedStyle(test).color;
    document.body.removeChild(test);
    
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    } else {
      return '#fff';
    }
  }
  
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000' : '#fff';
}
