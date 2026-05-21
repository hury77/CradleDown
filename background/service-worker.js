console.log("CradleDown background service worker loaded");

// Listen for download requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("CradleDown background received message:", request);
  
  if (request.action === 'DOWNLOAD_FILE') {
    handleDownload(request, sendResponse);
    return true; // Keep message channel open for async response
  }
});

async function handleDownload(request, sendResponse) {
  try {
    const { url, filename } = request;
    
    console.log(`🔽 Starting download: ${filename}`);
    console.log(`   URL: ${url}`);
    
    // Invoke chrome.downloads API
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false, // Do not prompt the user
      conflictAction: 'overwrite' // Overwrite duplicate filenames
    });
    
    console.log(`✅ Download started: ID ${downloadId}`);
    
    // Set up a listener to monitor this specific download
    const downloadListener = (downloadDelta) => {
      if (downloadDelta.id === downloadId && downloadDelta.state) {
        const state = downloadDelta.state.current;
        console.log(`🔄 Download state changed: ID ${downloadId} is now ${state}`);
        
        if (state === 'complete') {
          console.log(`✅ Download completed successfully: ${filename}`);
          chrome.downloads.onChanged.removeListener(downloadListener);
          sendResponse({ 
            success: true, 
            downloadId: downloadId,
            filename: filename
          });
        } else if (state === 'interrupted') {
          const errorCode = downloadDelta.error ? downloadDelta.error.current : 'Unknown';
          console.error(`❌ Download failed: ${filename} (Error: ${errorCode})`);
          chrome.downloads.onChanged.removeListener(downloadListener);
          sendResponse({ 
            success: false, 
            error: `Download interrupted: ${errorCode}`,
            filename: filename
          });
        }
      }
    };
    
    chrome.downloads.onChanged.addListener(downloadListener);
    
    // Backup Timeout: Remove listener and respond with failure after 5 minutes
    setTimeout(() => {
      chrome.downloads.onChanged.removeListener(downloadListener);
      sendResponse({ 
        success: false, 
        error: 'Download timeout (5 minutes)',
        filename: filename
      });
    }, 300000);
    
  } catch (error) {
    console.error("❌ Background download error:", error);
    sendResponse({ 
      success: false, 
      error: error.message,
      filename: request.filename
    });
  }
}

// Log lifecycle hooks
chrome.runtime.onStartup.addListener(() => {
  console.log("CradleDown extension started");
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("CradleDown extension installed/updated");
});
