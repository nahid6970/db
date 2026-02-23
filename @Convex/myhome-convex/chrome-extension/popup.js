const CONVEX_URL = "https://lovable-wildcat-595.convex.cloud";

document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('name');
  const urlInput = document.getElementById('url');
  const groupInput = document.getElementById('group');
  const addBtn = document.getElementById('add-btn');
  const statusDiv = document.getElementById('status');

  let currentFaviconUrl = "";

  // Fill in current tab info and fetch metadata
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      nameInput.value = tabs[0].title;
      urlInput.value = tabs[0].url;
      const url = tabs[0].url;
      const domain = new URL(url).hostname.replace('www.', '');
      currentFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

      // Try to fetch accurate metadata from backend
      try {
        const actionUrl = `${CONVEX_URL}/api/action`;
        const actionResponse = await fetch(actionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "actions:fetchPageTitle",
            args: { url },
            format: "json"
          })
        });
        
        if (actionResponse.ok) {
          const json = await actionResponse.json();
          const result = json.value || json;
          if (result.title) nameInput.value = result.title;
          if (result.channelIcon) currentFaviconUrl = result.channelIcon;
        }
      } catch (e) {
        console.warn("Metadata fetch failed:", e);
      }
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

    try {
      const fullLinkData = {
        name: name,
        group: group || '',
        urls: [url],
        url: url,
        default_type: 'img',
        img_src: currentFaviconUrl,
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
