let rootDirectoryHandle = null;
let currentDirectoryHandle = null;
let pathStack = [];
let currentEntries = [];
const selectedEntries = new Set();
let lastSelectedIndex = null;

let autoReloadTimer = null;
let isOperating = false;

// Sort state management
let currentSortKey = "name"; // 'name' | 'ext' | 'size' | 'date'
let currentSortOrder = "asc"; // 'asc' | 'desc'

// DOM Elements
const btnOpenDir = document.getElementById("btnOpenDir");
const currentDirPath = document.getElementById("currentDirPath");
const btnRefresh = document.getElementById("btnRefresh");

// Sort select boxes
const sortKeySelect = document.getElementById("sortKeySelect");
const sortOrderSelect = document.getElementById("sortOrderSelect");

const btnNewFile = document.getElementById("btnNewFile");
const btnNewFolder = document.getElementById("btnNewFolder");

const commonInput = document.getElementById("commonInput");
const btnBatchPrefix = document.getElementById("btnBatchPrefix");
const btnBatchSuffix = document.getElementById("btnBatchSuffix");
const btnBatchReplace = document.getElementById("btnBatchReplace");
const btnBatchRemove = document.getElementById("btnBatchRemove");
const btnBatchMove = document.getElementById("btnBatchMove");
const btnBatchNumbering = document.getElementById("btnBatchNumbering");

const autoReloadSelect = document.getElementById("autoReloadSelect");
const reloadIndicator = document.getElementById("reloadIndicator");

const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const selectedCountLabel = document.getElementById("selectedCountLabel");
const fileListBody = document.getElementById("fileListBody");

// Loading Elements
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingProgress = document.getElementById("loadingProgress");

// Modal Elements
const moveDialog = document.getElementById("moveDialog");
const moveDialogTitle = document.getElementById("moveDialogTitle");
const moveDialogDesc = document.getElementById("moveDialogDesc");
const folderSelectList = document.getElementById("folderSelectList");
const btnConfirmMove = document.getElementById("btnConfirmMove");
const btnCancelMove = document.getElementById("btnCancelMove");

// Numbering Modal Elements
const numberingDialog = document.getElementById("numberingDialog");
const numberingDialogDesc = document.getElementById("numberingDialogDesc");
const numStart = document.getElementById("numStart");
const numPadding = document.getElementById("numPadding");
const numPosition = document.getElementById("numPosition");
const numSeparator = document.getElementById("numSeparator");
const numberingList = document.getElementById("numberingList");
const btnConfirmNumbering = document.getElementById("btnConfirmNumbering");
const btnCancelNumbering = document.getElementById("btnCancelNumbering");
let pendingNumberingTargets = [];

let pendingMoveTargets = [];
let selectedDestDirHandle = null;

// -------------------------------------------------------------
// SVG Icon Definitions
// -------------------------------------------------------------
const ICONS = {
  folder: `<svg class="icon entry-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
  file: `<svg class="icon entry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
  menu: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  edit: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  move: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>`,
  delete: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>`,
  openExternal: `<svg class="icon-sm open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/></svg>`,
  drag: `<svg class="icon-sm drag-handle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`
};

const OPENABLE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif",
  ".txt", ".text", ".json", ".js", ".css", ".html", ".htm", ".xml", ".md", ".log", ".ini", ".yaml", ".yml", ".csv", ".tsv",
  ".pdf",
  ".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm"
]);

function isPreviewable(ext) {
  return OPENABLE_EXTENSIONS.has(ext.toLowerCase());
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// -------------------------------------------------------------
// Loading control helpers
// -------------------------------------------------------------
function showLoading(title, total) {
  loadingTitle.textContent = title;
  loadingProgress.textContent = `0 / ${total} items (0%)`;
  loadingOverlay.removeAttribute("hidden");
}

function updateLoading(current, total) {
  const percent = Math.round((current / total) * 100);
  loadingProgress.textContent = `${current} / ${total} items (${percent}%)`;
}

function hideLoading() {
  loadingOverlay.setAttribute("hidden", "");
}

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function verifyPermission(fileHandle, readWrite) {
  const options = {};
  if (readWrite) {
    options.mode = "readwrite";
  }
  if ((await fileHandle.queryPermission(options)) === "granted") {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === "granted") {
    return true;
  }
  return false;
}

function renderBreadcrumbs() {
  currentDirPath.innerHTML = "";
  if (!currentDirectoryHandle) {
    currentDirPath.textContent = "Not selected";
    return;
  }

  pathStack.forEach((segment, index) => {
    if (index > 0) {
      const arrow = document.createElement("span");
      arrow.className = "path-arrow";
      arrow.textContent = " > ";
      currentDirPath.appendChild(arrow);
    }

    const span = document.createElement("span");
    span.className = "path-segment";
    span.textContent = segment.name;
    
    if (index < pathStack.length - 1) {
      span.classList.add("clickable");
      span.onclick = async () => {
        pathStack = pathStack.slice(0, index + 1);
        currentDirectoryHandle = segment.handle;
        renderBreadcrumbs();
        await refreshList();
      };
    }
    currentDirPath.appendChild(span);
  });
}

// -------------------------------------------------------------
// 1. Open Directory Dialog
// -------------------------------------------------------------
btnOpenDir.addEventListener("click", async () => {
  try {
    rootDirectoryHandle = await window.showDirectoryPicker({
      mode: "readwrite",
      id: "folder_manager_working_dir"
    });
    currentDirectoryHandle = rootDirectoryHandle;
    pathStack = [{ name: rootDirectoryHandle.name, handle: rootDirectoryHandle }];
    renderBreadcrumbs();
    selectedEntries.clear();
    await refreshList();
    setupAutoReload();
  } catch (err) {
    if (err.name !== "AbortError") {
      alert(`Failed to open folder: ${err.message}`);
    }
  }
});

// -------------------------------------------------------------
// 2. Auto Reload
// -------------------------------------------------------------
function setupAutoReload() {
  if (autoReloadTimer) {
    clearInterval(autoReloadTimer);
    autoReloadTimer = null;
  }

  const seconds = parseInt(autoReloadSelect.value, 10);
  if (seconds > 0 && currentDirectoryHandle) {
    reloadIndicator.classList.add("active");
    autoReloadTimer = setInterval(async () => {
      if (!isOperating && selectedEntries.size === 0 && !moveDialog.open && !document.querySelector(".dropdown-menu.show")) {
        await refreshList(true);
      }
    }, seconds * 1000);
  } else {
    reloadIndicator.classList.remove("active");
  }
}

autoReloadSelect.addEventListener("change", setupAutoReload);

// -------------------------------------------------------------
// 3. Sort Logic
// -------------------------------------------------------------
sortKeySelect.addEventListener("change", (e) => {
  currentSortKey = e.target.value;
  updateSortIndicators();
  renderFileList();
});

sortOrderSelect.addEventListener("change", (e) => {
  currentSortOrder = e.target.value;
  updateSortIndicators();
  renderFileList();
});

document.querySelectorAll("th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (currentSortKey === key) {
      currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
      currentSortKey = key;
      currentSortOrder = key === "date" || key === "size" ? "desc" : "asc";
    }
    syncSortSelects();
    updateSortIndicators();
    renderFileList();
  });
});

function syncSortSelects() {
  sortKeySelect.value = currentSortKey;
  sortOrderSelect.value = currentSortOrder;
}

function updateSortIndicators() {
  ["name", "ext", "size", "date"].forEach((key) => {
    const el = document.getElementById(`sort-${key}`);
    if (el) {
      if (key === currentSortKey) {
        el.textContent = currentSortOrder === "asc" ? "▲" : "▼";
      } else {
        el.textContent = "";
      }
    }
  });
}

function sortEntries(entries) {
  const isAsc = currentSortOrder === "asc";
  const factor = isAsc ? 1 : -1;

  return entries.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "directory" ? -1 : 1;
    }

    if (currentSortKey === "name") {
      return a.baseName.localeCompare(b.baseName, undefined, { numeric: true }) * factor;
    } else if (currentSortKey === "ext") {
      return a.ext.localeCompare(b.ext, undefined) * factor;
    } else if (currentSortKey === "size") {
      return (a.size - b.size) * factor;
    } else if (currentSortKey === "date") {
      return (a.lastModified - b.lastModified) * factor;
    }
    return 0;
  });
}

// -------------------------------------------------------------
// 4. File List Fetching and Rendering
// -------------------------------------------------------------
async function refreshList(isSilent = false) {
  if (!currentDirectoryHandle) return;

  try {
    const rawEntries = [];
    for await (const entry of currentDirectoryHandle.values()) {
      rawEntries.push(entry);
    }

    const parsedEntries = await Promise.all(
      rawEntries.map(async (entry) => {
        let baseName = entry.name;
        let ext = "";
        let size = 0;
        let lastModified = 0;

        if (entry.kind === "directory") {
          baseName = entry.name;
          ext = "";
        } else {
          const lastDot = entry.name.lastIndexOf(".");
          if (lastDot > 0) {
            baseName = entry.name.substring(0, lastDot);
            ext = entry.name.substring(lastDot);
          }
          try {
            const file = await entry.getFile();
            size = file.size;
            lastModified = file.lastModified;
          } catch {
            size = 0;
            lastModified = 0;
          }
        }

        return {
          handle: entry,
          name: entry.name,
          baseName: baseName,
          ext: ext,
          size: size,
          kind: entry.kind,
          lastModified: lastModified
        };
      })
    );

    currentEntries = parsedEntries;

    if (!isSilent) {
      selectedEntries.clear();
      lastSelectedIndex = null;
      selectAllCheckbox.checked = false;
      updateSelectionCount();
    }

    renderFileList();
  } catch (err) {
    if (!isSilent) {
      if (err.name === "NotFoundError") {
        alert("The selected folder was deleted or moved. Resetting view.");
        currentDirectoryHandle = null;
        pathStack = [];
        renderBreadcrumbs();
        fileListBody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <p class="empty-title">Folder not found</p>
              <p class="empty-subtitle">Please click "Open Folder" above to select a working directory.</p>
            </td>
          </tr>`;
      } else {
        alert(`Failed to list files: ${err.message}`);
      }
    }
  }
}

function renderFileList() {
  fileListBody.innerHTML = "";

  if (currentEntries.length === 0) {
    fileListBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <p class="empty-title">Folder is empty</p>
          <p class="empty-subtitle">Create a new file or folder to get started.</p>
        </td>
      </tr>`;
    return;
  }

  const sorted = sortEntries([...currentEntries]);

  sorted.forEach((item, index) => {
    const isChecked = selectedEntries.has(item.handle);
    const row = document.createElement("tr");
    if (isChecked) row.classList.add("is-selected");

    if (item.kind === "directory") {
      row.addEventListener("dblclick", async (e) => {
        if (e.target.closest('.cell-check') || e.target.closest('.cell-actions') || e.target.closest('button')) return;
        try {
          const subDirHandle = await currentDirectoryHandle.getDirectoryHandle(item.name);
          if (!(await verifyPermission(subDirHandle, false))) {
            alert("Permission denied to access this folder.");
            return;
          }
          currentDirectoryHandle = subDirHandle;
          pathStack.push({ name: subDirHandle.name, handle: subDirHandle });
          renderBreadcrumbs();
          await refreshList();
        } catch (err) {
          alert(`Failed to access folder: ${err.message}`);
        }
      });
      // Indicate folder row is clickable
      row.style.cursor = "pointer";
    }

    // 1. Checkbox
    const checkCell = document.createElement("td");
    checkCell.className = "cell-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "custom-checkbox row-checkbox";
    checkbox.checked = isChecked;
    checkbox.onclick = (e) => {
      const checked = e.target.checked;
      
      if (e.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const allCheckboxes = fileListBody.querySelectorAll(".row-checkbox");
        const allRows = fileListBody.querySelectorAll("tr");
        
        for (let i = start; i <= end; i++) {
          const targetItem = sorted[i];
          const targetCb = allCheckboxes[i];
          const targetRow = allRows[i];
          
          if (checked) {
            selectedEntries.add(targetItem.handle);
            if (targetCb) targetCb.checked = true;
            if (targetRow) targetRow.classList.add("is-selected");
          } else {
            selectedEntries.delete(targetItem.handle);
            if (targetCb) targetCb.checked = false;
            if (targetRow) targetRow.classList.remove("is-selected");
          }
        }
      } else {
        if (checked) {
          selectedEntries.add(item.handle);
          row.classList.add("is-selected");
        } else {
          selectedEntries.delete(item.handle);
          row.classList.remove("is-selected");
        }
      }
      
      lastSelectedIndex = index;
      updateSelectionCount();
      updateSelectAllState();
    };
    checkCell.appendChild(checkbox);

    // 2. Name
    const nameCell = document.createElement("td");
    const isDir = item.kind === "directory";
    nameCell.className = "cell-name";
    nameCell.innerHTML = `
      <div class="cell-name-wrapper" title="${item.name}">
        ${isDir ? ICONS.folder : ICONS.file}
        <span>${item.baseName}</span>
      </div>
    `;

    // Open column
    const openCell = document.createElement("td");
    openCell.className = "cell-open";
    if (!isDir && isPreviewable(item.ext)) {
      const openBtn = document.createElement("button");
      openBtn.className = "btn-open-file";
      openBtn.title = "Preview in new tab";
      openBtn.innerHTML = ICONS.openExternal;
      openBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          const file = await item.handle.getFile();
          const fileUrl = URL.createObjectURL(file);
          window.open(fileUrl, "_blank");
        } catch (err) {
          alert(`Could not open file: ${err.message}`);
        }
      };
      openCell.appendChild(openBtn);
    }

    // 3. Extension
    const extCell = document.createElement("td");
    extCell.className = "cell-ext col-optional";
    if (isDir) {
      extCell.innerHTML = `<span class="ext-folder">-</span>`;
    } else {
      const cleanExt = item.ext.replace(/^\./, "");
      extCell.innerHTML = cleanExt ? `<span class="ext-badge">${cleanExt}</span>` : `<span class="ext-folder">-</span>`;
    }

    // 4. Size
    const sizeCell = document.createElement("td");
    sizeCell.className = "cell-size col-optional";
    if (isDir) {
      sizeCell.innerHTML = `<span class="size-folder">-</span>`;
    } else {
      sizeCell.innerHTML = `<span class="size-text">${formatBytes(item.size)}</span>`;
    }

    // 5. Date
    const dateCell = document.createElement("td");
    dateCell.className = "cell-date col-optional";
    if (item.lastModified > 0) {
      const d = new Date(item.lastModified);
      const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      dateCell.innerHTML = `<span class="date-text">${dateStr}</span>`;
    } else {
      dateCell.innerHTML = `<span class="date-text">-</span>`;
    }

    // 6. Action Menu Dropdown
    const actionCell = document.createElement("td");
    actionCell.className = "cell-actions";
    actionCell.innerHTML = `
      <div class="action-menu-container">
        <button class="btn-menu-trigger" title="Actions">${ICONS.menu}</button>
        <div class="dropdown-menu">
          <button class="menu-item menu-rename">${ICONS.edit}<span>Rename</span></button>
          <button class="menu-item menu-move">${ICONS.move}<span>Move</span></button>
          ${isDir ? "" : `<button class="menu-item danger menu-delete">${ICONS.delete}<span>Delete</span></button>`}
        </div>
      </div>
    `;

    const triggerBtn = actionCell.querySelector(".btn-menu-trigger");
    const dropdown = actionCell.querySelector(".dropdown-menu");

    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isAlreadyOpen = dropdown.classList.contains("show");

      document.querySelectorAll(".dropdown-menu.show").forEach((el) => {
        el.classList.remove("show", "drop-up");
        el.previousElementSibling?.classList.remove("active");
      });

      if (!isAlreadyOpen) {
        const rect = triggerBtn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 140) {
          dropdown.classList.add("drop-up");
        } else {
          dropdown.classList.remove("drop-up");
        }

        dropdown.classList.add("show");
        triggerBtn.classList.add("active");
      }
    });

    actionCell.querySelector(".menu-rename").onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.remove("show");
      triggerBtn.classList.remove("active");
      renameEntry(item.handle);
    };

    actionCell.querySelector(".menu-move").onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.remove("show");
      triggerBtn.classList.remove("active");
      openMoveModal([item.handle]);
    };

    const deleteBtn = actionCell.querySelector(".menu-delete");
    if (deleteBtn) {
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.remove("show");
        triggerBtn.classList.remove("active");
        deleteEntry(item.handle);
      };
    }

    row.appendChild(checkCell);
    row.appendChild(nameCell);
    row.appendChild(openCell);
    row.appendChild(extCell);
    row.appendChild(sizeCell);
    row.appendChild(dateCell);
    row.appendChild(actionCell);
    fileListBody.appendChild(row);
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".dropdown-menu.show").forEach((el) => {
    el.classList.remove("show", "drop-up");
    el.previousElementSibling?.classList.remove("active");
  });
});

selectAllCheckbox.addEventListener("change", (e) => {
  const checkboxes = fileListBody.querySelectorAll(".row-checkbox");
  const rows = fileListBody.querySelectorAll("tr");
  selectedEntries.clear();

  checkboxes.forEach((cb, index) => {
    cb.checked = e.target.checked;
    if (e.target.checked) {
      selectedEntries.add(currentEntries[index].handle);
      rows[index]?.classList.add("is-selected");
    } else {
      rows[index]?.classList.remove("is-selected");
    }
  });
  updateSelectionCount();
});

function updateSelectionCount() {
  selectedCountLabel.textContent = `${selectedEntries.size} items selected`;
}

function updateSelectAllState() {
  const checkboxes = fileListBody.querySelectorAll(".row-checkbox");
  const checkedBoxes = fileListBody.querySelectorAll(".row-checkbox:checked");
  selectAllCheckbox.checked = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
}

// -------------------------------------------------------------
// 5. Add Prefix / Suffix & Replace / Remove Text
// -------------------------------------------------------------
btnBatchPrefix.addEventListener("click", async () => {
  const prefix = commonInput.value;
  if (!prefix) {
    alert("Please enter a prefix in the input field.");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("Please select items to modify.");
    return;
  }

  const renameQueue = [];
  for (const handle of selectedEntries) {
    renameQueue.push({ handle: handle, oldName: handle.name, newName: `${prefix}${handle.name}` });
  }

  if (!confirm(`Add prefix "${prefix}" to ${renameQueue.length} selected item(s)?`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  isOperating = true;
  showLoading("Adding prefix...", renameQueue.length);

  for (let i = 0; i < renameQueue.length; i++) {
    const item = renameQueue[i];
    try {
      await item.handle.move(item.newName);
    } catch (err) {
      console.error(err);
    }
    updateLoading(i + 1, renameQueue.length);
    await nextTick();
  }

  hideLoading();
  isOperating = false;

  commonInput.value = "";
  await refreshList();
});

btnBatchSuffix.addEventListener("click", async () => {
  const suffix = commonInput.value;
  if (!suffix) {
    alert("Please enter a suffix in the input field.");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("Please select items to modify.");
    return;
  }

  const renameQueue = [];
  for (const handle of selectedEntries) {
    const originalName = handle.name;
    let newName = "";

    if (handle.kind === "directory") {
      newName = `${originalName}${suffix}`;
    } else {
      const lastDotIndex = originalName.lastIndexOf(".");
      if (lastDotIndex > 0) {
        const baseName = originalName.substring(0, lastDotIndex);
        const ext = originalName.substring(lastDotIndex);
        newName = `${baseName}${suffix}${ext}`;
      } else {
        newName = `${originalName}${suffix}`;
      }
    }

    renameQueue.push({ handle: handle, oldName: originalName, newName: newName });
  }

  if (!confirm(`Add suffix "${suffix}" to ${renameQueue.length} selected item(s)?`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  isOperating = true;
  showLoading("Adding suffix...", renameQueue.length);

  for (let i = 0; i < renameQueue.length; i++) {
    const item = renameQueue[i];
    try {
      await item.handle.move(item.newName);
    } catch (err) {
      console.error(err);
    }
    updateLoading(i + 1, renameQueue.length);
    await nextTick();
  }

  hideLoading();
  isOperating = false;

  commonInput.value = "";
  await refreshList();
});

btnBatchReplace.addEventListener("click", async () => {
  const targetStr = commonInput.value;
  if (!targetStr) {
    alert("Please enter the text to find in the input field.");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("Please select items to modify.");
    return;
  }

  const replacementStr = prompt(`Replace "${targetStr}" with:\n(Leave blank to remove)`);
  if (replacementStr === null) {
    return;
  }

  const renameQueue = [];
  for (const handle of selectedEntries) {
    const originalName = handle.name;
    let newName = "";

    if (handle.kind === "directory") {
      newName = originalName.replaceAll(targetStr, replacementStr);
    } else {
      const lastDotIndex = originalName.lastIndexOf(".");
      if (lastDotIndex > 0) {
        const baseName = originalName.substring(0, lastDotIndex);
        const ext = originalName.substring(lastDotIndex);
        const newBaseName = baseName.replaceAll(targetStr, replacementStr);
        if (!newBaseName.trim() && !ext) continue;
        newName = `${newBaseName}${ext}`;
      } else {
        newName = originalName.replaceAll(targetStr, replacementStr);
      }
    }

    if (newName && newName !== originalName) {
      renameQueue.push({ handle: handle, oldName: originalName, newName: newName });
    }
  }

  if (renameQueue.length === 0) {
    alert(`No matching items found containing "${targetStr}".`);
    return;
  }

  if (!confirm(`Found ${renameQueue.length} item(s) to replace.\nReplace "${targetStr}" with "${replacementStr}"?`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  isOperating = true;
  showLoading("Replacing text...", renameQueue.length);

  for (let i = 0; i < renameQueue.length; i++) {
    const item = renameQueue[i];
    try {
      await item.handle.move(item.newName);
    } catch (err) {
      console.error(err);
    }
    updateLoading(i + 1, renameQueue.length);
    await nextTick();
  }

  hideLoading();
  isOperating = false;

  commonInput.value = "";
  await refreshList();
});

btnBatchRemove.addEventListener("click", async () => {
  const targetStr = commonInput.value;
  if (!targetStr) {
    alert("Please enter the text to remove in the input field.");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("Please select items to modify.");
    return;
  }

  const renameQueue = [];
  for (const handle of selectedEntries) {
    const originalName = handle.name;
    let newName = "";

    if (handle.kind === "directory") {
      newName = originalName.replaceAll(targetStr, "");
    } else {
      const lastDotIndex = originalName.lastIndexOf(".");
      if (lastDotIndex > 0) {
        const baseName = originalName.substring(0, lastDotIndex);
        const ext = originalName.substring(lastDotIndex);
        const newBaseName = baseName.replaceAll(targetStr, "");
        if (!newBaseName.trim()) continue;
        newName = `${newBaseName}${ext}`;
      } else {
        newName = originalName.replaceAll(targetStr, "");
      }
    }

    if (newName && newName !== originalName) {
      renameQueue.push({ handle: handle, oldName: originalName, newName: newName });
    }
  }

  if (renameQueue.length === 0) {
    alert(`No matching items found containing "${targetStr}".`);
    return;
  }

  if (!confirm(`Found ${renameQueue.length} item(s) to remove.\nRemove "${targetStr}"?`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  isOperating = true;
  showLoading("Removing text...", renameQueue.length);

  for (let i = 0; i < renameQueue.length; i++) {
    const item = renameQueue[i];
    try {
      await item.handle.move(item.newName);
    } catch (err) {
      console.error(err);
    }
    updateLoading(i + 1, renameQueue.length);
    await nextTick();
  }

  hideLoading();
  isOperating = false;

  commonInput.value = "";
  await refreshList();
});

// -------------------------------------------------------------
// 6. Move Dialog
// -------------------------------------------------------------
async function getAllDirectories(handle, pathStr = "", excludePaths = new Set()) {
  const dirs = [];
  try {
    for await (const entry of handle.values()) {
      if (entry.kind === "directory") {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".venv") continue;
        const subPath = pathStr === "" ? `/${entry.name}` : `${pathStr}/${entry.name}`;
        
        let isExcluded = false;
        for (const exPath of excludePaths) {
           if (subPath === exPath || subPath.startsWith(`${exPath}/`)) {
             isExcluded = true;
             break;
           }
        }
        
        if (!isExcluded) {
          dirs.push({ name: subPath, handle: entry });
          const subDirs = await getAllDirectories(entry, subPath, excludePaths);
          dirs.push(...subDirs);
        }
      }
    }
  } catch (err) {
    console.warn("Directory fetch skipped:", pathStr, err);
  }
  return dirs;
}

async function openMoveModal(targets) {
  pendingMoveTargets = targets;
  selectedDestDirHandle = null;
  btnConfirmMove.disabled = true;

  const currentPathStr = pathStack.length > 1 ? "/" + pathStack.slice(1).map(s => s.name).join("/") : "";

  const excludePaths = new Set();
  targets.forEach(t => {
    if (t.kind === "directory") {
      excludePaths.add(`${currentPathStr}/${t.name}`);
    }
  });

  isOperating = true;
  showLoading("Searching folders...", 0);
  
  let validFolders = [];
  try {
    const allDirs = await getAllDirectories(rootDirectoryHandle, "", excludePaths);
    
    validFolders.push({ name: "/", handle: rootDirectoryHandle });
    validFolders.push(...allDirs);
    
    validFolders = validFolders.filter(d => {
      const dPath = d.name === "/" ? "" : d.name;
      return dPath !== currentPathStr;
    });

  } catch (err) {
    alert("Failed to find folders: " + err.message);
    hideLoading();
    isOperating = false;
    return;
  }
  hideLoading();
  isOperating = false;

  if (validFolders.length === 0) {
    alert("No available destination folders found.");
    return;
  }

  moveDialogTitle.textContent = `Select Destination Folder (${targets.length} items)`;
  moveDialogDesc.textContent = `Selected items: ${targets.length} items`;
  folderSelectList.innerHTML = "";

  validFolders.forEach((folder) => {
    const li = document.createElement("li");
    li.className = "folder-select-item";
    li.innerHTML = `
      <svg class="icon folder-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
      <span title="${folder.name}">${folder.name}</span>
    `;
    li.onclick = () => {
      document.querySelectorAll(".folder-select-item").forEach((el) => el.classList.remove("selected"));
      li.classList.add("selected");
      selectedDestDirHandle = folder.handle;
      btnConfirmMove.disabled = false;
    };
    folderSelectList.appendChild(li);
  });

  moveDialog.showModal();
}

btnCancelMove.addEventListener("click", () => moveDialog.close());

btnConfirmMove.addEventListener("click", async () => {
  if (!selectedDestDirHandle || pendingMoveTargets.length === 0) return;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  if (!(await verifyPermission(selectedDestDirHandle, true))) {
    alert("Write permission denied for destination folder.");
    return;
  }

  const total = pendingMoveTargets.length;
  moveDialog.close();

  isOperating = true;
  showLoading("Moving items...", total);

  try {
    const destDirHandle = selectedDestDirHandle;

    for (let i = 0; i < total; i++) {
      const entry = pendingMoveTargets[i];
      try {
        await entry.move(destDirHandle);
      } catch (err) {
        console.error(`Move failed: ${entry.name}`, err);
      }
      updateLoading(i + 1, total);
      await nextTick();
    }

    await refreshList();
  } catch (err) {
    alert(`Failed to move items: ${err.message}`);
  } finally {
    hideLoading();
    isOperating = false;
  }
});

btnBatchMove.addEventListener("click", () => {
  if (selectedEntries.size === 0) {
    alert("Please select items to move.");
    return;
  }
  openMoveModal(Array.from(selectedEntries));
});

// -------------------------------------------------------------
// 7. Create New / Individual Operations
// -------------------------------------------------------------
btnNewFile.addEventListener("click", async () => {
  if (!currentDirectoryHandle) return;
  const fileName = prompt("Enter new file name (e.g., memo.txt):");
  if (!fileName) return;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  try {
    const fileHandle = await currentDirectoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write("");
    await writable.close();
    await refreshList();
  } catch (err) {
    alert(`Failed to create file: ${err.message}`);
  }
});

btnNewFolder.addEventListener("click", async () => {
  if (!currentDirectoryHandle) return;
  const folderName = prompt("Enter new folder name:");
  if (!folderName) return;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  try {
    await currentDirectoryHandle.getDirectoryHandle(folderName, { create: true });
    await refreshList();
  } catch (err) {
    alert(`Failed to create folder: ${err.message}`);
  }
});

async function renameEntry(handle) {
  const isFile = handle.kind === "file";
  const originalName = handle.name;
  let baseName = originalName;
  let ext = "";

  if (isFile) {
    const lastDotIndex = originalName.lastIndexOf(".");
    if (lastDotIndex > 0) {
      baseName = originalName.substring(0, lastDotIndex);
      ext = originalName.substring(lastDotIndex);
    }
  }

  const promptMsg = isFile && ext
    ? `Enter new file name (extension ${ext} will be preserved):`
    : `Enter new name:`;

  const newBaseName = prompt(promptMsg, baseName);
  if (!newBaseName || newBaseName.trim() === "" || newBaseName === baseName) return;

  const newFullName = `${newBaseName.trim()}${ext}`;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  try {
    await handle.move(newFullName);
    await refreshList();
  } catch (err) {
    alert(`Failed to rename: ${err.message}`);
  }
}

async function deleteEntry(handle) {
  if (handle.kind === "directory") {
    alert("Deleting folders is not allowed.");
    return;
  }

  if (!confirm(`Delete "${handle.name}"?\n* This cannot be undone (permanently deleted, not sent to trash).`)) return;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }

  try {
    await currentDirectoryHandle.removeEntry(handle.name, { recursive: false });
    await refreshList();
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
}

// -------------------------------------------------------------
// 8. Numbering Dialog
// -------------------------------------------------------------
btnBatchNumbering.addEventListener("click", () => {
  if (selectedEntries.size === 0) {
    alert("Please select items to modify.");
    return;
  }
  
  // Sort selected items according to current table sort
  pendingNumberingTargets = sortEntries(Array.from(selectedEntries).map(handle => {
    return currentEntries.find(e => e.handle === handle);
  })).map(entry => entry.handle);

  numberingDialogDesc.textContent = `Target items: ${pendingNumberingTargets.length} items`;
  
  renderNumberingList();
  updateNumberingPreview();
  numberingDialog.showModal();
});

btnCancelNumbering.addEventListener("click", () => {
  numberingDialog.close();
});

function renderNumberingList() {
  numberingList.innerHTML = "";
  
  pendingNumberingTargets.forEach((handle, index) => {
    const li = document.createElement("li");
    li.className = "numbering-item";
    li.draggable = true;
    li.dataset.index = index;
    
    // Drag & Drop events
    li.addEventListener("dragstart", handleDragStart);
    li.addEventListener("dragover", handleDragOver);
    li.addEventListener("drop", handleDrop);
    li.addEventListener("dragenter", handleDragEnter);
    li.addEventListener("dragleave", handleDragLeave);
    li.addEventListener("dragend", handleDragEnd);

    const isDir = handle.kind === "directory";
    const icon = isDir ? ICONS.folder : ICONS.file;
    
    li.innerHTML = `
      <div class="numbering-item-left">
        ${ICONS.drag}
        ${icon}
        <span class="numbering-old-name" title="${handle.name}">${handle.name}</span>
      </div>
      <span class="numbering-preview-arrow">➔</span>
      <span class="numbering-preview-new" title=""></span>
    `;
    
    numberingList.appendChild(li);
  });
}

// Drag and drop handlers
let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.index);
  setTimeout(() => this.classList.add("dragging"), 0);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = "move";
  return false;
}

function handleDragEnter(e) {
  this.classList.add("drag-over");
}

function handleDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (dragSrcEl !== this) {
    const srcIndex = parseInt(dragSrcEl.dataset.index);
    const destIndex = parseInt(this.dataset.index);
    
    const targetHandle = pendingNumberingTargets.splice(srcIndex, 1)[0];
    pendingNumberingTargets.splice(destIndex, 0, targetHandle);
    
    renderNumberingList();
    updateNumberingPreview();
  }
  return false;
}

function handleDragEnd(e) {
  this.classList.remove("dragging");
  document.querySelectorAll(".numbering-item").forEach(item => {
    item.classList.remove("drag-over");
  });
}

// Preview calculation
function updateNumberingPreview() {
  const start = parseInt(numStart.value) || 0;
  const padding = parseInt(numPadding.value) || 1;
  const pos = numPosition.value;
  const sep = numSeparator.value;
  
  const items = numberingList.querySelectorAll(".numbering-item");
  
  items.forEach((item, idx) => {
    const handle = pendingNumberingTargets[idx];
    const originalName = handle.name;
    const numStr = String(start + idx).padStart(padding, "0");
    let newName = "";
    
    if (handle.kind === "directory") {
      newName = pos === "prefix" 
        ? `${numStr}${sep}${originalName}` 
        : `${originalName}${sep}${numStr}`;
    } else {
      const lastDotIndex = originalName.lastIndexOf(".");
      if (lastDotIndex > 0) {
        const baseName = originalName.substring(0, lastDotIndex);
        const ext = originalName.substring(lastDotIndex);
        newName = pos === "prefix"
          ? `${numStr}${sep}${baseName}${ext}`
          : `${baseName}${sep}${numStr}${ext}`;
      } else {
        newName = pos === "prefix"
          ? `${numStr}${sep}${originalName}`
          : `${originalName}${sep}${numStr}`;
      }
    }
    
    const newNameEl = item.querySelector(".numbering-preview-new");
    newNameEl.textContent = newName;
    newNameEl.title = newName;
    item.dataset.newName = newName;
  });
}

// Update preview on setting inputs
[numStart, numPadding, numPosition, numSeparator].forEach(el => {
  el.addEventListener("input", updateNumberingPreview);
  el.addEventListener("change", updateNumberingPreview);
});

btnConfirmNumbering.addEventListener("click", async () => {
  if (pendingNumberingTargets.length === 0) return;
  
  // Build rename queue
  const renameQueue = [];
  const items = numberingList.querySelectorAll(".numbering-item");
  items.forEach((item, idx) => {
    const handle = pendingNumberingTargets[idx];
    const oldName = handle.name;
    const newName = item.dataset.newName;
    if (oldName !== newName) {
      renameQueue.push({ handle, oldName, newName });
    }
  });
  
  if (renameQueue.length === 0) {
    alert("No items to rename.");
    return;
  }
  
  // Pre-check for naming collisions with existing files
  const originalNamesInBatch = new Set(renameQueue.map(q => q.oldName));
  for (const q of renameQueue) {
    const existing = currentEntries.find(e => e.name === q.newName);
    if (existing && !originalNamesInBatch.has(q.newName)) {
      alert(`Error: Name conflict with existing item "${q.newName}".\nPlease adjust settings or move the existing item.`);
      return;
    }
  }
  
  if (!confirm(`Apply numbering to ${renameQueue.length} item(s)?`)) {
    return;
  }
  
  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("Write permission denied for current folder.");
    return;
  }
  
  numberingDialog.close();
  isOperating = true;
  const totalSteps = renameQueue.length * 2;
  showLoading("Applying numbering...", totalSteps);
  
  let currentStep = 0;
  const tempPrefix = `temp_${Date.now()}_`;
  
  try {
    // Step 1: Move to temporary names to avoid chain collisions
    for (const q of renameQueue) {
      q.tempName = `${tempPrefix}${q.oldName}`;
      await q.handle.move(q.tempName);
      currentStep++;
      updateLoading(currentStep, totalSteps);
      await nextTick();
    }
    
    // Step 2: Move from temporary names to final names
    for (const q of renameQueue) {
      await q.handle.move(q.newName);
      currentStep++;
      updateLoading(currentStep, totalSteps);
      await nextTick();
    }
  } catch (err) {
    console.error("Error during batch numbering rename", err);
    alert(`Error during renaming: ${err.message}\nSome files may remain with temporary names.`);
  } finally {
    hideLoading();
    isOperating = false;
    await refreshList();
  }
});

btnRefresh.addEventListener("click", () => refreshList());