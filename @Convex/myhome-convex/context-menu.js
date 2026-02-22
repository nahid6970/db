let contextMenu = null;

function showContextMenu(event, items) {
  event.preventDefault();
  event.stopPropagation();
  
  if (!contextMenu) {
    contextMenu = document.getElementById('context-menu');
  }
  
  contextMenu.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'context-menu-item' + (item.className ? ' ' + item.className : '');
    div.textContent = item.label;
    div.onclick = () => {
      item.action();
      hideContextMenu();
    };
    contextMenu.appendChild(div);
  });
  
  contextMenu.style.left = event.clientX + 'px';
  contextMenu.style.top = event.clientY + 'px';
  contextMenu.classList.remove('hidden');
  
  // Adjust position if menu goes off screen
  const rect = contextMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  if (rect.right > viewportWidth) {
    contextMenu.style.left = (viewportWidth - rect.width - 10) + 'px';
  }
  if (rect.bottom > viewportHeight) {
    contextMenu.style.top = (viewportHeight - rect.height - 10) + 'px';
  }
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.add('hidden');
  }
}

document.addEventListener('click', hideContextMenu);
window.showContextMenu = showContextMenu;
