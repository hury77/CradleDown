/**
 * CradleDown - Premium Chrome Extension Content Script
 * Orchestrates multiple file queuing and sequential downloading for Cradle attachments.
 */

class CradleDownController {
  constructor() {
    this.queue = []; // Array of queued files in click order: { id, url, filename, element }
    this.assetId = "unknown_asset";
    this.panelElement = null;
    this.isDownloading = false;
    this.checkboxCounter = 0;

    console.log("📥 [CradleDown] Initializing extension content script...");
    
    this.init();
  }

  async init() {
    // 1. Detect Asset ID
    this.assetId = this.detectAssetId();
    console.log(`📥 [CradleDown] Detected Asset ID: ${this.assetId}`);

    // 2. Inject custom CSS styles for premium look & feel
    this.injectStyles();

    // 3. Setup dynamic DOM observer to handle SPA navigation or dynamic loading
    this.setupObserver();

    // 4. Initial checkbox injection
    this.scanAndInject();
  }

  /**
   * Extract Asset ID from URL or DOM structure
   */
  detectAssetId() {
    // Try URL matching first
    const urlMatch = window.location.href.match(/\/assets\/deliverable-details\/(\d+)/);
    if (urlMatch) return urlMatch[1];

    // Fallback: search DOM for Asset ID label
    const cells = document.querySelectorAll('td, th, span, div, dt, dd');
    for (const el of cells) {
      const text = el.textContent.trim().toLowerCase();
      if (text === 'asset id') {
        const next = el.nextElementSibling;
        if (next && /^\d+$/.test(next.textContent.trim())) {
          return next.textContent.trim();
        }
        const parentRow = el.closest('tr');
        if (parentRow) {
          const tds = parentRow.querySelectorAll('td');
          if (tds.length >= 2) {
            const val = tds[tds.length - 1].textContent.trim();
            if (/^\d+$/.test(val)) return val;
          }
        }
      }
    }

    // Try regex-searching raw visible elements
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0) {
        const match = el.textContent.match(/Asset\s+id\s+(\d+)/i);
        if (match) return match[1];
      }
    }

    return "unknown_asset";
  }

  /**
   * Monitor DOM mutations to automatically inject checkboxes into new comments or tables
   */
  setupObserver() {
    const observer = new MutationObserver(() => {
      this.scanAndInject();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Injects premium custom styled checkboxes next to attachments in the Attachment column
   */
  scanAndInject() {
    // Find all tables on the page
    const tables = document.querySelectorAll("table");
    
    tables.forEach((table) => {
      // Find the header rows to identify the 'Attachment' column index
      const headers = table.querySelectorAll("thead th, tr th");
      let attachmentColIndex = -1;

      headers.forEach((th, idx) => {
        const headerText = th.textContent.trim().toLowerCase();
        // Match 'attachment' but explicitly ignore 'nc attachment'
        if (headerText === "attachment") {
          attachmentColIndex = idx;
        }
      });

      if (attachmentColIndex === -1) return; // Table does not have an Attachment column

      // Scan rows in the body
      const rows = table.querySelectorAll("tbody tr, tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length <= attachmentColIndex) return;

        const cell = cells[attachmentColIndex];
        
        // Find valid attachment links inside the column
        // Standard links under /media/cradle/ or having file icons
        const links = cell.querySelectorAll('a[href*="/media/"]');
        
        links.forEach((link) => {
          // Avoid injecting duplicate checkboxes
          if (link.dataset.cradledownInjected) return;
          link.dataset.cradledownInjected = "true";

          const fileUrl = link.href;
          const fileName = this.extractFilename(fileUrl, link);

          // Accept any file from the attachment column, excluding mailto and hash links
          if (fileUrl.startsWith('mailto:') || fileUrl === '#') {
            return;
          }

          // Create styled premium checkbox wrapper
          this.checkboxCounter++;
          const checkboxId = `cradledown-cb-${this.checkboxCounter}`;

          const cbWrapper = document.createElement("div");
          cbWrapper.className = "cradledown-checkbox-container";
          cbWrapper.innerHTML = `
            <div class="cradledown-checkbox" id="${checkboxId}" title="Select to download queue">
              <span class="cb-inner">+</span>
            </div>
          `;

          // Inject checkbox directly before the attachment link/icon
          link.parentNode.insertBefore(cbWrapper, link);

          // Event Listener for the premium checkbox click
          const checkboxEl = cbWrapper.querySelector(".cradledown-checkbox");
          checkboxEl.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleQueue(checkboxId, fileUrl, fileName, checkboxEl);
          });
        });
      });
    });
  }

  /**
   * Helper to extract clean filename from URL or link text
   */
  extractFilename(url, linkElement) {
    try {
      const urlObj = new URL(url);
      let filename = urlObj.pathname.split("/").pop();
      filename = decodeURIComponent(filename);
      if (filename && filename.includes(".")) return filename;
    } catch (e) {}

    // Fallback to text content
    let text = linkElement.textContent.trim();
    if (text && text.includes(".")) {
      return text.replace(/[\\/:*?"<>|\r\n]+/g, "_");
    }

    return "attachment_file";
  }

  /**
   * Toggle a file in or out of the sequential download queue
   */
  toggleQueue(id, url, filename, element) {
    if (this.isDownloading) {
      this.showNotification("Downloads are currently running. Please wait...", "warning");
      return;
    }

    const index = this.queue.findIndex(item => item.id === id);

    if (index === -1) {
      // 1. Add to queue
      this.queue.push({ id, url, filename, element });
      element.classList.add("selected");
      this.animateScale(element);
      this.showNotification(`Added to queue: ${filename}`, "info");
    } else {
      // 2. Remove from queue
      this.queue.splice(index, 1);
      element.classList.remove("selected");
      element.querySelector(".cb-inner").textContent = "+";
      this.showNotification(`Removed from queue: ${filename}`, "info");
    }

    // 3. Refresh checkboxes numbering
    this.refreshCheckboxNumbers();

    // 4. Update chrome.storage.local queuedCount
    try {
      chrome.storage.local.set({ queuedCount: this.queue.length });
    } catch (e) {
      console.warn("Storage sync error:", e);
    }

    // 5. Update the Floating Panel
    this.updatePanel();
  }

  /**
   * Play a small spring animation scale-up on select
   */
  animateScale(element) {
    element.style.transform = "scale(1.25)";
    setTimeout(() => {
      element.style.transform = "";
    }, 180);
  }

  /**
   * Refresh consecutive sequence numbers in selected checkboxes
   */
  refreshCheckboxNumbers() {
    this.queue.forEach((item, index) => {
      const numberSpan = item.element.querySelector(".cb-inner");
      if (numberSpan) {
        numberSpan.textContent = index + 1;
      }
    });
  }

  /**
   * Renders and manages the glassmorphism floating queue panel at the bottom-right
   */
  updatePanel() {
    // 1. Create panel element if not exists
    if (!this.panelElement) {
      this.panelElement = document.createElement("div");
      this.panelElement.id = "cradledown-panel";
      this.panelElement.className = "cradledown-glass-panel";
      document.body.appendChild(this.panelElement);
    }

    // 2. Hide panel if queue is empty
    if (this.queue.length === 0 && !this.isDownloading) {
      this.panelElement.classList.remove("visible");
      return;
    }

    this.panelElement.classList.add("visible");

    // 3. Render HTML
    const count = this.queue.length;
    let fileListHtml = this.queue
      .map(
        (item, idx) => `
        <div class="panel-file-item">
          <div class="file-badge">${idx + 1}</div>
          <div class="file-name" title="${item.filename}">${item.filename}</div>
          <button class="file-remove-btn" data-id="${item.id}">×</button>
        </div>
      `
      )
      .join("");

    if (count === 0 && this.isDownloading) {
      fileListHtml = `<div class="empty-queue-text">Initializing downloads...</div>`;
    }

    this.panelElement.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">📥 CradleDown Queue</div>
        <div class="panel-badge">${count}</div>
      </div>
      
      <div class="panel-status-bar">
        <span id="cradledown-status-text">Ready to download</span>
      </div>

      <div class="panel-progress-container">
        <div id="cradledown-progress-bar" class="panel-progress-bar" style="width: 0%"></div>
      </div>

      <div class="panel-file-list">
        ${fileListHtml}
      </div>

      <div class="panel-actions">
        <button id="cradledown-btn-download" class="panel-btn-primary ${count === 0 ? 'disabled' : ''}">
          Download to folder ${this.assetId}
        </button>
        <button id="cradledown-btn-clear" class="panel-btn-secondary">Clear</button>
      </div>
    `;

    // 4. Bind event listeners for actions inside panel
    const downloadBtn = this.panelElement.querySelector("#cradledown-btn-download");
    const clearBtn = this.panelElement.querySelector("#cradledown-btn-clear");
    const removeBtns = this.panelElement.querySelectorAll(".file-remove-btn");

    if (downloadBtn && count > 0) {
      downloadBtn.addEventListener("click", () => this.startSequentialDownloads());
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearSelection());
    }

    removeBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        const matched = this.queue.find(item => item.id === id);
        if (matched) {
          this.toggleQueue(matched.id, matched.url, matched.filename, matched.element);
        }
      });
    });
  }

  /**
   * Clear the selected queue completely
   */
  clearSelection() {
    if (this.isDownloading) return;

    this.queue.forEach((item) => {
      item.element.classList.remove("selected");
      item.element.querySelector(".cb-inner").textContent = "+";
    });

    this.queue = [];
    
    // Reset chrome.storage.local queuedCount
    try {
      chrome.storage.local.set({ queuedCount: 0 });
    } catch (e) {
      console.warn("Storage sync error:", e);
    }

    this.updatePanel();
    this.showNotification("Queue cleared", "info");
  }

  /**
   * Run sequential downloads, processing one file at a time in precise queue order
   */
  async startSequentialDownloads() {
    if (this.isDownloading || this.queue.length === 0) return;

    console.log("📥 [CradleDown] Starting sequential queue downloads...");
    this.isDownloading = true;

    // UI elements to lock
    const downloadBtn = this.panelElement.querySelector("#cradledown-btn-download");
    const clearBtn = this.panelElement.querySelector("#cradledown-btn-clear");
    const statusText = this.panelElement.querySelector("#cradledown-status-text");
    const progressBar = this.panelElement.querySelector("#cradledown-progress-bar");
    
    if (downloadBtn) downloadBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    
    // Hide remove buttons from queue list during downloading
    this.panelElement.querySelectorAll(".file-remove-btn").forEach(btn => btn.style.display = "none");

    const totalFiles = this.queue.length;
    let successfulCount = 0;
    const fileNameCounts = {};

    for (let i = 0; i < totalFiles; i++) {
      const file = this.queue[i];
      const displayIndex = i + 1;
      
      // Update UI for active item
      if (statusText) statusText.textContent = `Downloading (${displayIndex}/${totalFiles}): ${file.filename}...`;
      console.log(`📥 [CradleDown] Sequential Download [${displayIndex}/${totalFiles}]: ${file.filename}`);
      
      // Update item style in DOM to pulsing active
      const itemEl = this.panelElement.querySelectorAll(".panel-file-item")[i];
      if (itemEl) itemEl.classList.add("active-download");

      // Format clean filename and destination subfolder (Asset ID)
      let sanitizedName = file.filename.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim();
      
      // Handle duplicates by appending a sequence number
      if (fileNameCounts[sanitizedName]) {
        const count = fileNameCounts[sanitizedName];
        fileNameCounts[sanitizedName] = count + 1;
        const lastDotIndex = sanitizedName.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          sanitizedName = sanitizedName.substring(0, lastDotIndex) + `_${count}` + sanitizedName.substring(lastDotIndex);
        } else {
          sanitizedName += `_${count}`;
        }
      } else {
        fileNameCounts[sanitizedName] = 1;
      }
      
      const destinationPath = `${this.assetId}/${sanitizedName}`;

      // Trigger download and wait for service-worker response
      const success = await this.triggerDownload(file.url, destinationPath);

      // Update progress styles
      if (itemEl) {
        itemEl.classList.remove("active-download");
        itemEl.classList.add(success ? "download-success" : "download-error");
      }

      if (success) {
        successfulCount++;
        file.element.classList.remove("selected");
        file.element.classList.add("downloaded-success");
        file.element.querySelector(".cb-inner").textContent = "✓";
      } else {
        file.element.classList.add("downloaded-failed");
        file.element.querySelector(".cb-inner").textContent = "⚠";
      }

      // Update progress bar
      if (progressBar) {
        const percent = Math.round((displayIndex / totalFiles) * 100);
        progressBar.style.width = `${percent}%`;
      }

      // Sync remaining queued count
      try {
        chrome.storage.local.set({ queuedCount: totalFiles - displayIndex });
      } catch (e) {}
    }

    // Finished sequential downloads
    if (statusText) statusText.textContent = `Completed! ${successfulCount} of ${totalFiles} downloaded.`;
    this.showNotification(`Sequential downloads finished! Success: ${successfulCount}/${totalFiles}`, "success");
    
    // Update local storage statistics (grabbed and remaining queue)
    try {
      chrome.storage.local.get({ grabbedCount: 0 }, (items) => {
        chrome.storage.local.set({
          grabbedCount: items.grabbedCount + successfulCount,
          queuedCount: 0
        });
      });
    } catch (e) {
      console.warn("Storage sync error:", e);
    }

    // Re-enable actions
    if (downloadBtn) {
      downloadBtn.textContent = "Finished!";
      downloadBtn.style.background = "linear-gradient(135deg, #4CAF50, #2E7D32)";
    }

    setTimeout(() => {
      this.isDownloading = false;
      this.queue = [];
      this.updatePanel();
    }, 4000);
  }

  /**
   * Promisified wrapper around message passing to background script for downloading
   */
  triggerDownload(url, filename) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "DOWNLOAD_FILE",
          url: url,
          filename: filename
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("📥 [CradleDown] Extension messaging error:", chrome.runtime.lastError.message);
            resolve(false);
          } else {
            resolve(response && response.success === true);
          }
        }
      );
    });
  }

  /**
   * Standardized floating notifications/toasts injected directly into page
   */
  showNotification(message, type = "info") {
    const containerId = "cradledown-notif-container";
    let container = document.getElementById(containerId);
    
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `cradledown-toast ${type}`;
    
    let emoji = "ℹ️";
    if (type === "success") emoji = "✅";
    if (type === "warning") emoji = "⚠️";
    if (type === "error") emoji = "❌";

    toast.innerHTML = `
      <span class="toast-emoji">${emoji}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Fade-in trigger
    setTimeout(() => toast.classList.add("visible"), 50);

    // Self-destruct after 3.5 seconds
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  /**
   * Premium styled stylesheet injected into the head
   */
  injectStyles() {
    const styleId = "cradledown-injected-styles";
    if (document.getElementById(styleId)) return;

    const styles = `
      /* Circular checkbox indicators injected in table column */
      .cradledown-checkbox-container {
        display: inline-block;
        vertical-align: middle;
        margin-right: 8px;
      }
      .cradledown-checkbox {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid #3b82f6;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        transform-origin: center;
        user-select: none;
      }
      .cradledown-checkbox:hover {
        background: #eff6ff;
        border-color: #2563eb;
        transform: scale(1.15);
        box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
      }
      .cradledown-checkbox.selected {
        background: #2563eb;
        border-color: #1d4ed8;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
      }
      .cradledown-checkbox.selected .cb-inner {
        color: #ffffff;
        font-weight: 700;
        font-size: 11px;
      }
      .cradledown-checkbox .cb-inner {
        font-size: 13px;
        color: #3b82f6;
        font-weight: 600;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        line-height: 1;
        transition: color 0.2s;
      }
      
      .cradledown-checkbox.downloaded-success {
        background: #10b981 !important;
        border-color: #059669 !important;
      }
      .cradledown-checkbox.downloaded-success .cb-inner {
        color: white !important;
      }

      .cradledown-checkbox.downloaded-failed {
        background: #ef4444 !important;
        border-color: #dc2626 !important;
      }
      .cradledown-checkbox.downloaded-failed .cb-inner {
        color: white !important;
      }

      /* Premium Glassmorphic Side Panel */
      .cradledown-glass-panel {
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 330px;
        max-height: 480px;
        background: rgba(22, 28, 45, 0.88);
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4), 0 5px 15px rgba(0, 0, 0, 0.2);
        color: #f3f4f6;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: translateY(150px) scale(0.9);
        opacity: 0;
        pointer-events: none;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .cradledown-glass-panel.visible {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: auto;
      }
      .panel-header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .panel-title {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: #ffffff;
      }
      .panel-badge {
        background: linear-gradient(135deg, #3b82f6, #6366f1);
        color: white;
        font-weight: 700;
        font-size: 12px;
        padding: 2px 10px;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
      }
      .panel-status-bar {
        padding: 8px 20px;
        background: rgba(255, 255, 255, 0.03);
        font-size: 12px;
        color: #9ca3af;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .panel-progress-container {
        height: 4px;
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
      }
      .panel-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #10b981);
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
        transition: width 0.3s ease;
      }
      .panel-file-list {
        flex-grow: 1;
        overflow-y: auto;
        padding: 12px 16px;
        max-height: 220px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .panel-file-list::-webkit-scrollbar {
        width: 6px;
      }
      .panel-file-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
      }
      .panel-file-item {
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.04);
        padding: 8px 12px;
        border-radius: 10px;
        transition: all 0.2s ease;
      }
      .panel-file-item:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.08);
      }
      .file-badge {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: #d1d5db;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        margin-right: 10px;
        flex-shrink: 0;
      }
      .file-name {
        font-size: 13px;
        flex-grow: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #e5e7eb;
        padding-right: 8px;
      }
      .file-remove-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 16px;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.15s;
      }
      .file-remove-btn:hover {
        color: #ef4444;
      }
      .empty-queue-text {
        color: #6b7280;
        font-size: 13px;
        text-align: center;
        padding: 20px 0;
      }
      
      .active-download {
        border-color: rgba(59, 130, 246, 0.4) !important;
        background: rgba(59, 130, 246, 0.1) !important;
        animation: cradledown-pulse 1.5s infinite;
      }
      .download-success {
        border-color: rgba(16, 185, 129, 0.4) !important;
        background: rgba(16, 185, 129, 0.08) !important;
      }
      .download-success .file-badge {
        background: #10b981;
        color: white;
      }
      .download-error {
        border-color: rgba(239, 68, 68, 0.4) !important;
        background: rgba(239, 68, 68, 0.08) !important;
      }
      .download-error .file-badge {
        background: #ef4444;
        color: white;
      }

      .panel-actions {
        padding: 16px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        gap: 10px;
        background: rgba(11, 15, 26, 0.4);
      }
      .panel-btn-primary {
        flex-grow: 1;
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        color: white;
        border: none;
        padding: 10px 14px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
      }
      .panel-btn-primary:hover:not(:disabled) {
        transform: translateY(-1.5px);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.5);
      }
      .panel-btn-primary:active:not(:disabled) {
        transform: translateY(0);
      }
      .panel-btn-primary.disabled, .panel-btn-primary:disabled {
        background: #374151 !important;
        color: #9ca3af;
        cursor: not-allowed;
        box-shadow: none !important;
        transform: none !important;
      }
      .panel-btn-secondary {
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #d1d5db;
        padding: 10px 12px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .panel-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.12);
        color: white;
      }

      /* Injected Toasts Container & Alerts */
      #cradledown-notif-container {
        position: fixed;
        top: 25px;
        right: 25px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .cradledown-toast {
        background: rgba(23, 27, 38, 0.92);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f3f4f6;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 13px;
        font-family: system-ui, sans-serif;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateX(120%);
        opacity: 0;
        transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
      }
      .cradledown-toast.visible {
        transform: translateX(0);
        opacity: 1;
      }
      .toast-emoji {
        font-size: 16px;
      }
      .toast-message {
        font-weight: 500;
      }

      @keyframes cradledown-pulse {
        0% { opacity: 0.8; }
        50% { opacity: 0.4; }
        100% { opacity: 0.8; }
      }
    `;

    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

// Instantiate the controller
if (typeof window.cradleDownInstance === "undefined") {
  window.cradleDownInstance = new CradleDownController();
}
