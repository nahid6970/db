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
  
  contextMenu.style.left = event.pageX + 'px';
  contextMenu.style.top = event.pageY + 'px';
  contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.add('hidden');
  }
}

document.addEventListener('click', hideContextMenu);
window.showContextMenu = showContextMenu;
