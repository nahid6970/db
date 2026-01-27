// Popup script for user interaction

const statusDiv = document.getElementById('status');

function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = type;
}

// Save data button
document.getElementById('saveBtn').addEventListener('click', () => {
  showStatus('Saving data...', 'info');
  
  chrome.runtime.sendMessage({ action: 'saveData' }, (response) => {
    if (response.success) {
      showStatus('Data saved successfully!', 'success');
    } else {
      showStatus(`Error: ${response.error}`, 'error');
    }
  });
});

// Check server button
document.getElementById('checkBtn').addEventListener('click', () => {
  showStatus('Checking server...', 'info');
  
  chrome.runtime.sendMessage({ action: 'checkServer' }, (response) => {
    if (response.success) {
      showStatus('Server is running!', 'success');
    } else {
      showStatus('Server not responding. Make sure Python script is running.', 'error');
    }
  });
});
