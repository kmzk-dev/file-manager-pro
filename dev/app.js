let rootDirectoryHandle = null;
let currentDirectoryHandle = null;
let pathStack = [];
let currentEntries = [];
const selectedEntries = new Set();

let autoReloadTimer = null;
let isOperating = false;

// ソート状態管理
let currentSortKey = "name"; // 'name' | 'ext' | 'size' | 'date'
let currentSortOrder = "asc"; // 'asc' | 'desc'

// DOM要素
const btnOpenDir = document.getElementById("btnOpenDir");
const currentDirPath = document.getElementById("currentDirPath");
const btnRefresh = document.getElementById("btnRefresh");

// 2連ソートセレクトボックス
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

const autoReloadSelect = document.getElementById("autoReloadSelect");
const reloadIndicator = document.getElementById("reloadIndicator");

const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const selectedCountLabel = document.getElementById("selectedCountLabel");
const fileListBody = document.getElementById("fileListBody");

// ローディング要素
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingProgress = document.getElementById("loadingProgress");

// モーダル要素
const moveDialog = document.getElementById("moveDialog");
const moveDialogTitle = document.getElementById("moveDialogTitle");
const moveDialogDesc = document.getElementById("moveDialogDesc");
const folderSelectList = document.getElementById("folderSelectList");
const btnConfirmMove = document.getElementById("btnConfirmMove");
const btnCancelMove = document.getElementById("btnCancelMove");

let pendingMoveTargets = [];
let selectedDestDirHandle = null;

// -------------------------------------------------------------
// SVG アイコン定義
// -------------------------------------------------------------
const ICONS = {
  folder: `<svg class="icon entry-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
  file: `<svg class="icon entry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
  menu: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  edit: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  move: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>`,
  delete: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>`,
  openExternal: `<svg class="icon-sm open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
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
// ローディング制御ヘルパー
// -------------------------------------------------------------
function showLoading(title, total) {
  loadingTitle.textContent = title;
  loadingProgress.textContent = `0 / ${total} 件 (0%)`;
  loadingOverlay.removeAttribute("hidden");
}

function updateLoading(current, total) {
  const percent = Math.round((current / total) * 100);
  loadingProgress.textContent = `${current} / ${total} 件 (${percent}%)`;
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
    currentDirPath.textContent = "未選択";
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
// 1. フォルダ選択ダイアログ
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
      alert(`フォルダ読み込みエラー: ${err.message}`);
    }
  }
});

// -------------------------------------------------------------
// 2. オートリロード（自動更新）
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
// 3. ソートロジック（2連セレクト & ヘッダークリック連動）
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
      return a.baseName.localeCompare(b.baseName, "ja", { numeric: true }) * factor;
    } else if (currentSortKey === "ext") {
      return a.ext.localeCompare(b.ext, "ja") * factor;
    } else if (currentSortKey === "size") {
      return (a.size - b.size) * factor;
    } else if (currentSortKey === "date") {
      return (a.lastModified - b.lastModified) * factor;
    }
    return 0;
  });
}

// -------------------------------------------------------------
// 4. 一覧の取得と描画
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
      selectAllCheckbox.checked = false;
      updateSelectionCount();
    }

    renderFileList();
  } catch (err) {
    if (!isSilent) {
      if (err.name === "NotFoundError") {
        alert("操作中のフォルダが削除または移動されたため、表示を初期化します。");
        currentDirectoryHandle = null;
        pathStack = [];
        renderBreadcrumbs();
        fileListBody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <p class="empty-title">フォルダが見つかりません</p>
              <p class="empty-subtitle">上部の「フォルダを開く」から作業ディレクトリを選択してください。</p>
            </td>
          </tr>`;
      } else {
        alert(`一覧取得エラー: ${err.message}`);
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
          <p class="empty-title">フォルダは空です</p>
          <p class="empty-subtitle">新規ファイルまたは新規フォルダを作成してください。</p>
        </td>
      </tr>`;
    return;
  }

  const sorted = sortEntries([...currentEntries]);

  for (const item of sorted) {
    const isChecked = selectedEntries.has(item.handle);
    const row = document.createElement("tr");
    if (isChecked) row.classList.add("is-selected");

    if (item.kind === "directory") {
      row.addEventListener("dblclick", async (e) => {
        if (e.target.closest('.cell-check') || e.target.closest('.cell-actions') || e.target.closest('button')) return;
        try {
          const subDirHandle = await currentDirectoryHandle.getDirectoryHandle(item.name);
          if (!(await verifyPermission(subDirHandle, false))) {
            alert("このフォルダへのアクセス権限がありません。");
            return;
          }
          currentDirectoryHandle = subDirHandle;
          pathStack.push({ name: subDirHandle.name, handle: subDirHandle });
          renderBreadcrumbs();
          await refreshList();
        } catch (err) {
          alert(`フォルダへのアクセスエラー: ${err.message}`);
        }
      });
      // フォルダ行はクリック可能であることを示す
      row.style.cursor = "pointer";
    }

    // 1. チェックボックス
    const checkCell = document.createElement("td");
    checkCell.className = "cell-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "custom-checkbox row-checkbox";
    checkbox.checked = isChecked;
    checkbox.onchange = (e) => {
      if (e.target.checked) {
        selectedEntries.add(item.handle);
        row.classList.add("is-selected");
      } else {
        selectedEntries.delete(item.handle);
        row.classList.remove("is-selected");
      }
      updateSelectionCount();
      updateSelectAllState();
    };
    checkCell.appendChild(checkbox);

    // 2. 名前
    const nameCell = document.createElement("td");
    const isDir = item.kind === "directory";
    nameCell.className = "cell-name";
    nameCell.innerHTML = `
      <div class="cell-name-wrapper" title="${item.name}">
        ${isDir ? ICONS.folder : ICONS.file}
        <span>${item.baseName}</span>
      </div>
    `;

    // 開く列
    const openCell = document.createElement("td");
    openCell.className = "cell-open";
    if (!isDir && isPreviewable(item.ext)) {
      const openBtn = document.createElement("button");
      openBtn.className = "btn-open-file";
      openBtn.title = "別タブでプレビュー";
      openBtn.innerHTML = ICONS.openExternal;
      openBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          const file = await item.handle.getFile();
          const fileUrl = URL.createObjectURL(file);
          window.open(fileUrl, "_blank");
        } catch (err) {
          alert(`ファイルを開くことができませんでした: ${err.message}`);
        }
      };
      openCell.appendChild(openBtn);
    }

    // 3. 拡張子
    const extCell = document.createElement("td");
    extCell.className = "cell-ext col-optional";
    if (isDir) {
      extCell.innerHTML = `<span class="ext-folder">-</span>`;
    } else {
      const cleanExt = item.ext.replace(/^\./, "");
      extCell.innerHTML = cleanExt ? `<span class="ext-badge">${cleanExt}</span>` : `<span class="ext-folder">-</span>`;
    }

    // 4. サイズ
    const sizeCell = document.createElement("td");
    sizeCell.className = "cell-size col-optional";
    if (isDir) {
      sizeCell.innerHTML = `<span class="size-folder">-</span>`;
    } else {
      sizeCell.innerHTML = `<span class="size-text">${formatBytes(item.size)}</span>`;
    }

    // 5. 日時
    const dateCell = document.createElement("td");
    dateCell.className = "cell-date col-optional";
    if (item.lastModified > 0) {
      const d = new Date(item.lastModified);
      const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      dateCell.innerHTML = `<span class="date-text">${dateStr}</span>`;
    } else {
      dateCell.innerHTML = `<span class="date-text">-</span>`;
    }

    // 6. ≡ メニュードロップダウン
    const actionCell = document.createElement("td");
    actionCell.className = "cell-actions";
    actionCell.innerHTML = `
      <div class="action-menu-container">
        <button class="btn-menu-trigger" title="操作メニュー">${ICONS.menu}</button>
        <div class="dropdown-menu">
          <button class="menu-item menu-rename">${ICONS.edit}<span>リネーム</span></button>
          <button class="menu-item menu-move">${ICONS.move}<span>移動</span></button>
          ${isDir ? "" : `<button class="menu-item danger menu-delete">${ICONS.delete}<span>削除</span></button>`}
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
  }
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
  selectedCountLabel.textContent = `${selectedEntries.size} 件選択中`;
}

function updateSelectAllState() {
  const checkboxes = fileListBody.querySelectorAll(".row-checkbox");
  const checkedBoxes = fileListBody.querySelectorAll(".row-checkbox:checked");
  selectAllCheckbox.checked = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
}

// -------------------------------------------------------------
// 5. Prefix / Suffix 挿入 & 文字列除去
// -------------------------------------------------------------
btnBatchPrefix.addEventListener("click", async () => {
  const prefix = commonInput.value;
  if (!prefix) {
    alert("文字列入力欄にPrefixを入力してください。");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("対象の項目を選択してください。");
    return;
  }

  const renameQueue = [];
  for (const handle of selectedEntries) {
    renameQueue.push({ handle: handle, oldName: handle.name, newName: `${prefix}${handle.name}` });
  }

  if (!confirm(`選択した ${renameQueue.length} 件の先頭に「${prefix}」を追加しますか？`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  isOperating = true;
  showLoading("Prefixを追加中...", renameQueue.length);

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
    alert("文字列入力欄にSuffixを入力してください。");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("対象の項目を選択してください。");
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

  if (!confirm(`選択した ${renameQueue.length} 件の末尾に「${suffix}」を追加しますか？`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  isOperating = true;
  showLoading("Suffixを追加中...", renameQueue.length);

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
    alert("文字列入力欄に置き換え元の文字列を入力してください。");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("対象の項目を選択してください。");
    return;
  }

  const replacementStr = prompt(`「${targetStr}」を何に置き換えますか？\n(空欄にした場合は削除と同じになります)`);
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
        if (!newBaseName.trim() && !ext) continue; // ファイル名全体が空になるのを防ぐ（拡張子があれば許容）
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
    alert("対象の文字列が含まれる項目が見つかりませんでした。");
    return;
  }

  if (!confirm(`${renameQueue.length} 件の置き換え候補が見つかりました。\n「${targetStr}」を「${replacementStr}」に置き換えますか？`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  isOperating = true;
  showLoading("文字列を置換中...", renameQueue.length);

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
    alert("文字列入力欄に除去したい文字列を入力してください。");
    commonInput.focus();
    return;
  }

  if (selectedEntries.size === 0) {
    alert("対象の項目を選択してください。");
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
    alert("対象の文字列が含まれる項目が見つかりませんでした。");
    return;
  }

  if (!confirm(`${renameQueue.length} 件の除去候補が見つかりました。\n「${targetStr}」を除去しますか？`)) {
    return;
  }

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  isOperating = true;
  showLoading("文字列を除去中...", renameQueue.length);

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
// 6. 移動モーダル
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
    console.warn("ディレクトリ取得スキップ:", pathStr, err);
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
  showLoading("移動先フォルダを検索中...", 0);
  
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
    alert("フォルダ検索エラー: " + err.message);
    hideLoading();
    isOperating = false;
    return;
  }
  hideLoading();
  isOperating = false;

  if (validFolders.length === 0) {
    alert("移動先として選択可能なフォルダが存在しません。");
    return;
  }

  moveDialogTitle.textContent = `移動先のフォルダを選択 (${targets.length} 件)`;
  moveDialogDesc.textContent = `選択中のアイテム: 合計 ${targets.length} 件`;
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
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  if (!(await verifyPermission(selectedDestDirHandle, true))) {
    alert("移動先フォルダへの書き込み権限がありません。");
    return;
  }

  const total = pendingMoveTargets.length;
  moveDialog.close();

  isOperating = true;
  showLoading("フォルダへ移動中...", total);

  try {
    const destDirHandle = selectedDestDirHandle;

    for (let i = 0; i < total; i++) {
      const entry = pendingMoveTargets[i];
      try {
        await entry.move(destDirHandle);
      } catch (err) {
        console.error(`移動失敗: ${entry.name}`, err);
      }
      updateLoading(i + 1, total);
      await nextTick();
    }

    await refreshList();
  } catch (err) {
    alert(`移動エラー: ${err.message}`);
  } finally {
    hideLoading();
    isOperating = false;
  }
});

btnBatchMove.addEventListener("click", () => {
  if (selectedEntries.size === 0) {
    alert("移動したい項目にチェックを入れてください。");
    return;
  }
  openMoveModal(Array.from(selectedEntries));
});

// -------------------------------------------------------------
// 7. 新規作成・個別操作
// -------------------------------------------------------------
btnNewFile.addEventListener("click", async () => {
  if (!currentDirectoryHandle) return;
  const fileName = prompt("新規作成するファイル名 (例: memo.txt):");
  if (!fileName) return;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  try {
    const fileHandle = await currentDirectoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write("");
    await writable.close();
    await refreshList();
  } catch (err) {
    alert(`ファイル作成失敗: ${err.message}`);
  }
});

btnNewFolder.addEventListener("click", async () => {
  if (!currentDirectoryHandle) return;
  const folderName = prompt("新規フォルダ名:");
  if (!folderName) return;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  try {
    await currentDirectoryHandle.getDirectoryHandle(folderName, { create: true });
    await refreshList();
  } catch (err) {
    alert(`フォルダ作成失敗: ${err.message}`);
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
    ? `新しいファイル名を入力してください (拡張子 ${ext} は自動維持されます):`
    : `新しい名前を入力してください:`;

  const newBaseName = prompt(promptMsg, baseName);
  if (!newBaseName || newBaseName.trim() === "" || newBaseName === baseName) return;

  const newFullName = `${newBaseName.trim()}${ext}`;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  try {
    await handle.move(newFullName);
    await refreshList();
  } catch (err) {
    alert(`リネーム失敗: ${err.message}`);
  }
}

async function deleteEntry(handle) {
  if (handle.kind === "directory") {
    alert("フォルダの削除は許可されていません。");
    return;
  }

  if (!confirm(`「${handle.name}」を削除しますか？\n※この操作は元に戻せません（ゴミ箱には入らず、直接完全削除されます）。`)) return;

  if (!(await verifyPermission(currentDirectoryHandle, true))) {
    alert("現在のフォルダへの書き込み権限がありません。");
    return;
  }

  try {
    await currentDirectoryHandle.removeEntry(handle.name, { recursive: false });
    await refreshList();
  } catch (err) {
    alert(`削除失敗: ${err.message}`);
  }
}

btnRefresh.addEventListener("click", () => refreshList());