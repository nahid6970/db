// Background script for Chrome extension
// This communicates with the Python server

const PYTHON_SERVER = 'http://localhost:8765';
const EXTENSION_NAME = 'my_extension'; // Change this for each extension (folder name)
const FILE_NAME = 'data.json'; // Change this to your preferred filename

// Function to send data to Python server
async function sendDataToPython(data) {
  try {
    const response = await fetch(PYTHON_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extension_name: EXTENSION_NAME,
        file_name: FILE_NAME,
        data: data
      })
    });
    
    const result = await response.json();
    console.log('Data sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending data to Python:', error);
    throw error;
  }
}

// Example: Auto-save when storage changes
chrome.storage.local.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed, syncing with Python...');
  
  // Get all data and send to Python
  chrome.storage.local.get(null, (items) => {
    sendDataToPython(items)
      .then(() => console.log('Sync complete'))
      .catch(err => console.error('Sync failed:', err));
  });
});

// Listen for manual save requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveData') {
    chrome.storage.local.get(null, (items) => {
      sendDataToPython(items)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'checkServer') {
    fetch(`${PYTHON_SERVER}/health`)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
