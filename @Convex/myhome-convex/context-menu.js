let contextMenu = null;

function showContextMenu(event, items, options = {}) {
  event.preventDefault();
  event.stopPropagation();
  
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
    button.title = item.title || label;
    button.setAttribute('aria-label', label);
    if (layout === 'strip-layout') {
      button.innerHTML = `
        <span class="context-menu-icon" aria-hidden="true">${icon}</span>
        <span class="sr-only">${label}</span>
      `;
    } else {
      button.textContent = label;
    }
    button.onclick = () => {
      item.action();
      hideContextMenu();
    };
    contextMenu.appendChild(button);
  });
  
  contextMenu.style.visibility = 'hidden';
  contextMenu.classList.remove('hidden');
  contextMenu.classList.add('visible');

  const x = Math.min(event.clientX, window.innerWidth - contextMenu.offsetWidth - 6);
  const y = Math.min(event.clientY, window.innerHeight - contextMenu.offsetHeight - 6);
  contextMenu.style.left = Math.max(6, x) + 'px';
  contextMenu.style.top = Math.max(6, y) + 'px';
  contextMenu.style.visibility = '';
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.remove('visible');
    contextMenu.classList.add('hidden');
  }
}

document.addEventListener('click', hideContextMenu);
window.showContextMenu = showContextMenu;
