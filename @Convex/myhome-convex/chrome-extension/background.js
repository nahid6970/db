const CONVEX_URL = "https://lovable-wildcat-595.convex.cloud";

// Function to create context menus at the top level so they show immediately on right-click without hovering/submenus
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "addLink_ungrouped",
      title: "Add to MyHome (Ungrouped)",
      contexts: ["page", "link"]
    });
    chrome.contextMenus.create({
      id: "addLink_XMIUI",
      title: "Add to MyHome (Group: XMIUI)",
      contexts: ["page", "link"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Context menu creation error:", chrome.runtime.lastError);
      } else {
        console.log("Context menus created successfully");
      }
    });
  });
}

// Create on install and on startup
chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);
createContextMenu();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addLink_ungrouped" || info.menuItemId === "addLink_XMIUI") {
    const groupName = info.menuItemId === "addLink_XMIUI" ? "XMIUI" : "";
    try {
      const url = info.linkUrl || info.pageUrl;
      if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
        showNotification("Invalid URL", "Cannot add links from this page.");
        return;
      }

      const domain = new URL(url).hostname.replace('www.', '');
      let title = tab.title || "New Link";
      let faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

      // Try to fetch accurate metadata from backend action
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
          if (result.title) title = result.title;
          if (result.channelIcon) faviconUrl = result.channelIcon;
        }
      } catch (e) {
        console.warn("Metadata fetch failed, using fallbacks:", e);
      }
      
      const newLink = {
        name: title,
        group: groupName,
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
        title: title,
        hidden: false,
        collapsible: false,
        box_group: false,
        horizontal_stack: false,
        password_protect: false
      };

      await addLinkToConvex(newLink);
    } catch (err) {
      console.error("Context menu click handler error:", err);
      showNotification("Error", "An error occurred while preparing the link.");
    }
  }
});

async function addLinkToConvex(linkData) {
  try {
    console.log("Attempting to add link:", linkData.url, "Group:", linkData.group);
    
    const url = `${CONVEX_URL}/api/mutation`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: "functions:addLink",
        args: linkData,
        format: "json"
      })
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
      const groupLabel = linkData.group ? ` (Group: ${linkData.group})` : " (Ungrouped)";
      showNotification("Added to MyHome", `Successfully added "${linkData.name}"${groupLabel}.`);
    } else {
      let errorMessage = responseText;
      try {
        const json = JSON.parse(responseText);
        errorMessage = json.message || json.error || responseText;
      } catch (e) {}
      
      showNotification("Failed to Add", `Error ${response.status}: ${errorMessage}`);
    }
  } catch (error) {
    console.error("Error adding link to Convex:", error);
    showNotification("Connection Error", `Error: ${error.message}`);
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: title,
    message: message,
    priority: 2
  });
}
