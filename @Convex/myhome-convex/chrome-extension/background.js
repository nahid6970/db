const CONVEX_URL = "https://lovable-wildcat-595.convex.cloud";

// Function to create context menu
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "addLinkToMyHome",
      title: "Add Link to MyHome",
      contexts: ["page", "link"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Context menu creation error:", chrome.runtime.lastError);
      } else {
        console.log("Context menu created successfully");
      }
    });
  });
}

// Create on install and on startup
chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

// Also try to create it immediately just in case
createContextMenu();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addLinkToMyHome") {
    try {
      const url = info.linkUrl || info.pageUrl;
      if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
        showNotification("Invalid URL", "Cannot add links from this page.");
        return;
      }

      const title = tab.title || "New Link";
      
      // Default values for a new link
      let faviconUrl = "";
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      } catch (e) {
        console.warn("Favicon generation failed:", e);
      }
      
      const newLink = {
        name: title,
        group: "",
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
        hidden: false
      };

      addLinkToConvex(newLink);
    } catch (err) {
      console.error("Context menu click handler error:", err);
      showNotification("Error", "An error occurred while preparing the link.");
    }
  }
});

async function addLinkToConvex(linkData) {
  try {
    console.log("Attempting to add link:", linkData.url);
    
    // Construct the full object exactly as links-handler.js does
    const fullLinkData = {
      name: linkData.name || "New Link",
      group: linkData.group || '',
      urls: linkData.urls || [linkData.url],
      url: linkData.url,
      default_type: linkData.default_type || 'img',
      img_src: linkData.img_src || '',
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
      title: linkData.name || "New Link",
      hidden: false,
      collapsible: false,
      box_group: false,
      horizontal_stack: false,
      password_protect: false
    };

    // Use the Convex HTTP API format
    const url = `${CONVEX_URL}/api/mutation`;
    console.log("Fetching URL:", url);

    const response = await fetch(url, {
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
      console.log("Successfully added link to MyHome");
      showNotification("Added to MyHome", `Successfully added "${fullLinkData.name}" to your Inbox.`);
    } else {
      console.error(`Failed to add link (Status ${response.status}):`, responseText);
      
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
