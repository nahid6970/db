let contextMenu = null;

function getAnchorRect(trigger, options) {
  const anchor = options.anchorElement
    || (trigger && typeof trigger.getBoundingClientRect === 'function' ? trigger : null)
    || (trigger && trigger.currentTarget && typeof trigger.currentTarget.getBoundingClientRect === 'function' ? trigger.currentTarget : null)
    || (trigger && trigger.target && typeof trigger.target.getBoundingClientRect === 'function' ? trigger.target : null);

  return anchor ? anchor.getBoundingClientRect() : null;
}

function showContextMenu(trigger, items, options = {}) {
  if (trigger && typeof trigger.preventDefault === 'function') {
    trigger.preventDefault();
  }
  if (trigger && typeof trigger.stopPropagation === 'function') {
    trigger.stopPropagation();
  }
  
  if (!contextMenu) {
    contextMenu = document.getElementById('context-menu');
  }
  
  contextMenu.innerHTML = '';
  const layout = options.layout === 'list' ? 'list-layout' : 'strip-layout';
  contextMenu.classList.remove('list-layout', 'strip-layout');
  contextMenu.classList.add(layout);
  items.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'context-menu-item' + (item.className ? ' ' + item.className : '');
    const label = item.label || item.title || '';
    const icon = item.icon || '•';
    const tooltip = item.title || label;
    button.setAttribute('aria-label', label);
    if (item.disabled) {
      button.disabled = true;
    }
    if (layout === 'strip-layout') {
      button.setAttribute('data-tooltip', tooltip);
      button.innerHTML = `
        <span class="context-menu-icon" aria-hidden="true">${icon}</span>
        <span class="sr-only">${label}</span>
      `;
    } else {
      button.title = tooltip;
      button.textContent = label;
    }
    if (!item.disabled) {
      button.onclick = () => {
        item.action();
        hideContextMenu();
      };
    }
    contextMenu.appendChild(button);
  });
  
  contextMenu.style.visibility = 'hidden';
  contextMenu.classList.remove('hidden');
  contextMenu.classList.add('visible');

  const anchorRect = getAnchorRect(trigger, options);
  if (anchorRect) {
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const left = Math.min(anchorRect.left, window.innerWidth - menuWidth - 6);
    const belowTop = anchorRect.bottom + 4;
    const aboveTop = anchorRect.top - menuHeight - 4;
    const top = belowTop + menuHeight <= window.innerHeight - 6
      ? belowTop
      : Math.max(6, aboveTop);
    contextMenu.style.left = Math.max(6, left) + 'px';
    contextMenu.style.top = Math.max(6, top) + 'px';
  } else {
    const clientX = typeof trigger?.clientX === 'number' ? trigger.clientX : 6;
    const clientY = typeof trigger?.clientY === 'number' ? trigger.clientY : 6;
    const x = Math.min(clientX, window.innerWidth - contextMenu.offsetWidth - 6);
    const y = Math.min(clientY, window.innerHeight - contextMenu.offsetHeight - 6);
    contextMenu.style.left = Math.max(6, x) + 'px';
    contextMenu.style.top = Math.max(6, y) + 'px';
  }
  contextMenu.style.visibility = '';
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.remove('visible');
    contextMenu.classList.add('hidden');
  }
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!target) {
    hideContextMenu();
    return;
  }

  if (contextMenu && contextMenu.contains(target)) {
    return;
  }

  if (typeof target.closest === 'function' && target.closest('.group-input-container')) {
    return;
  }

  hideContextMenu();
});
window.showContextMenu = showContextMenu;
