const CONVEX_URL = "https://lovable-wildcat-595.convex.cloud";

document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('name');
  const urlInput = document.getElementById('url');
  const groupInput = document.getElementById('group');
  const addBtn = document.getElementById('add-btn');
  const statusDiv = document.getElementById('status');

  // Fill in current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      nameInput.value = tabs[0].title;
      urlInput.value = tabs[0].url;
    }
  });

  addBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const group = groupInput.value.trim();

    if (!name || !url) {
      statusDiv.textContent = 'Please provide name and URL.';
      statusDiv.className = 'error';
      return;
    }

    statusDiv.textContent = 'Adding...';
    statusDiv.className = '';

    const domain = new URL(url).hostname.replace('www.', '');
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    const newLink = {
      name: name,
      group: group || "",
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
      title: name,
      hidden: false
    };

    try {
      const fullLinkData = {
        name: name,
        group: group || '',
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
        title: name,
        hidden: false,
        collapsible: false,
        box_group: false,
        horizontal_stack: false,
        password_protect: false
      };

      const response = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          path: "functions:addLink",
          args: fullLinkData,
          format: "json"
        })
      });

      const responseText = await response.text();
      console.log(`Server responded with status ${response.status}`);

      if (response.ok) {
        statusDiv.textContent = 'Successfully added!';
        statusDiv.className = 'success';
        setTimeout(() => window.close(), 1500);
      } else {
        console.error(`Failed to add link (Status ${response.status}):`, responseText);
        
        let errorMessage = responseText;
        try {
          const json = JSON.parse(responseText);
          errorMessage = json.message || json.error || responseText;
        } catch (e) {}
        
        statusDiv.textContent = `Error ${response.status}: ${errorMessage.substring(0, 50)}`;
        statusDiv.className = 'error';
      }
    } catch (error) {
      console.error("Error adding link to Convex:", error);
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.className = 'error';
    }
  });
});
