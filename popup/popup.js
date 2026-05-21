document.addEventListener("DOMContentLoaded", async () => {
  const statusLabel = document.getElementById("status-label");
  const statusDesc = document.getElementById("status-desc");
  const pulseDot = document.querySelector(".pulse-dot");
  const statDownloaded = document.getElementById("stat-downloaded");
  const statQueued = document.getElementById("stat-queued");

  // 1. Check if active tab is on Cradle
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url) {
      if (tab.url.includes("cradle.egplusww.pl")) {
        statusLabel.textContent = "Active on Cradle";
        statusLabel.style.color = "#34d399";
        statusDesc.textContent = "Ready to grab attachments";
        if (pulseDot) {
          pulseDot.style.backgroundColor = "#10b981";
          pulseDot.style.boxShadow = "0 0 8px #10b981";
        }
      } else {
        statusLabel.textContent = "Inactive Page";
        statusLabel.style.color = "#94a3b8";
        statusDesc.textContent = "Navigate to cradle.egplusww.pl";
        if (pulseDot) {
          pulseDot.style.backgroundColor = "#64748b";
          pulseDot.style.boxShadow = "none";
          pulseDot.style.animation = "none";
        }
      }
    }
  } catch (error) {
    console.error("Error querying active tab:", error);
  }

  // 2. Load and listen for statistics from storage
  const updateStats = () => {
    chrome.storage.local.get({ grabbedCount: 0, queuedCount: 0 }, (items) => {
      if (statDownloaded) statDownloaded.textContent = items.grabbedCount;
      if (statQueued) statQueued.textContent = items.queuedCount;
    });
  };

  // Initial load
  updateStats();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      updateStats();
    }
  });
});
