// google-drive.js — Google Drive integration
// gapi and google are globals loaded via <script> tags.

import { cm, status, showLoading, hideLoading } from './editor.js';
import { triggerRender } from './render.js';
import {
  fileHandles, activeFileIdx, savedContent, storageMode,
  setStorageMode, setDirHandle, setActiveFileIdx, setActiveFileName, setSavedContent, setDirtyFlag, setFileHandles,
  isDirty, openFile, doSave, setOpenFile, setDoSave,
  renderFileList, idbSet, idbGet,
} from './file-manager.js';
import { showDiffModal, threeWayMerge } from './diff-merge.js';

// ── DOM refs ────────────────────────────────────────────────────────
const fileSidebar = document.getElementById("fileSidebar");
const folderNameEl = document.getElementById("folderName");
const paneFileName = document.getElementById("paneFileName");
const btnSave = document.getElementById("btnSave");

// ── Google Drive API ───────────────────────────────────────────────
const GD_SCOPES = "https://www.googleapis.com/auth/drive";
let gdToken = null;         // OAuth access token
let gdFolderId = null;      // selected folder ID
let gdDriveId = null;       // shared drive ID (null for My Drive)
let gdFolderName = "";      // folder name from picker
let gdModifiedTime = null;  // modifiedTime from Drive when file was loaded

function getGdSettings() {
  return {
    clientId: localStorage.getItem("gd_client_id") || "",
    apiKey: localStorage.getItem("gd_api_key") || "",
  };
}

export function saveGoogleSettings() {
  localStorage.setItem("gd_client_id", document.getElementById("gdClientId").value.trim());
  localStorage.setItem("gd_api_key", document.getElementById("gdApiKey").value.trim());
  document.getElementById("settingsModal").classList.remove("open");
  status.textContent = "Google Drive settings saved";
}

// Apply settings from URL parameters (e.g. ?clientId=xxx&apiKey=yyy)
(function() {
  const params = new URLSearchParams(window.location.search);
  const urlClientId = params.get("clientId");
  const urlApiKey = params.get("apiKey");
  if (urlClientId) localStorage.setItem("gd_client_id", urlClientId);
  if (urlApiKey) localStorage.setItem("gd_api_key", urlApiKey);
  // Clean URL to avoid leaking credentials in browser history
  if (urlClientId || urlApiKey) {
    params.delete("clientId");
    params.delete("apiKey");
    const clean = params.toString();
    history.replaceState(null, "", location.pathname + (clean ? "?" + clean : ""));
    status.textContent = "Google Drive settings applied from URL";
  }
})();

// Populate settings inputs on load
(function() {
  const s = getGdSettings();
  document.getElementById("gdClientId").value = s.clientId;
  document.getElementById("gdApiKey").value = s.apiKey;
})();

async function initGapi() {
  if (typeof gapi === "undefined") throw new Error("Google API script failed to load (blocked by browser?)");
  await new Promise((resolve, reject) => {
    gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Failed to load picker")) });
  });
}

// Direct fetch wrapper for Drive API (bypasses gapi.client token issues)
async function driveApiFetch(path, params) {
  const url = new URL("https://www.googleapis.com/drive/v3/" + path);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url, { headers: { "Authorization": "Bearer " + gdToken } });
  if (!resp.ok) throw new Error("Drive API " + resp.status + ": " + (await resp.text()));
  return resp.json();
}

async function getGdToken(silent) {
  // Try stored token first
  const stored = sessionStorage.getItem("gd_token");
  if (stored) {
    gdToken = stored;
    // Verify it's still valid
    try {
      const r = await fetch("https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + stored);
      if (r.ok) return gdToken;
    } catch(e) {}
    sessionStorage.removeItem("gd_token");
    gdToken = null;
  }
  if (silent) return null; // don't prompt

  const s = getGdSettings();
  if (!s.clientId) throw new Error("Client ID not configured");
  if (typeof google === "undefined" || !google.accounts) throw new Error("Google Identity Services failed to load (blocked by browser?)");
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: s.clientId,
      scope: GD_SCOPES,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error + ": " + (resp.error_description || "no details")));
        gdToken = resp.access_token;
        sessionStorage.setItem("gd_token", gdToken);
        resolve(gdToken);
      },
      error_callback: (err) => {
        reject(new Error(err.type || err.message || JSON.stringify(err)));
      },
    });
    client.requestAccessToken();
  });
}

export async function openGoogleDrive() {
  try {
    const s = getGdSettings();
    if (!s.clientId || !s.apiKey) {
      document.getElementById("settingsModal").classList.add("open");
      status.textContent = "Configure Google Drive settings first";
      return;
    }
    status.textContent = "Connecting to Google Drive...";
    await initGapi();
    await getGdToken();

    // Pick a folder
    const picked = await pickFolder();
    if (!picked) return;
    gdFolderId = picked.id;
    gdDriveId = picked.driveId;
    gdFolderName = picked.name;
    setStorageMode("gdrive");

    // Clear local folder state so restore picks GDrive
    setDirHandle(null);
    await idbSet("dirHandle", null);

    // Persist folder for reload
    localStorage.setItem("gd_folder_id", gdFolderId);
    localStorage.setItem("gd_drive_id", gdDriveId || "");
    localStorage.setItem("gd_folder_name", gdFolderName || "");

    // Update URL
    const url = new URL(location.href);
    url.searchParams.delete("file");
    url.searchParams.delete("driveFile");
    url.searchParams.set("driveFolder", gdFolderId);
    history.replaceState(null, "", url);

    await activateGdFolder();
  } catch(e) {
    console.error("Google Drive error:", e);
    status.textContent = "Google Drive error: " + (e.message || e);
  }
}

// Reconnect to stored Drive folder (on reload)
export async function tryRestoreGdrive() {
  const s = getGdSettings();
  const fId = localStorage.getItem("gd_folder_id");
  if (!s.clientId || !s.apiKey || !fId) return false;

  await initGapi();
  const token = await getGdToken(true); // silent — use stored token
  if (!token) {
    status.textContent = "Click Google Drive to reconnect";
    return false;
  }

  gdFolderId = fId;
  gdDriveId = localStorage.getItem("gd_drive_id") || null;
  gdFolderName = localStorage.getItem("gd_folder_name") || "Google Drive";
  setStorageMode("gdrive");

  const restoreFile = await idbGet("activeFile");
  await activateGdFolder(restoreFile || null);
  return true;
}

export async function restoreDriveFile(fileId) {
  const s = getGdSettings();
  if (!s.clientId || !s.apiKey || !fileId) return false;
  await initGapi();
  const token = await getGdToken(true);
  if (!token) return false;

  // Fetch file metadata for the name
  const meta = await driveApiFetch("files/" + fileId, { fields: "name", supportsAllDrives: "true" });
  showLoading("Loading " + meta.name + "...");
  const text = await fetchGdFileContent(fileId);
  cm.setValue(text);
  cm.clearHistory();
  hideLoading();
  document.getElementById("paneFileName").textContent = meta.name;
  document.title = meta.name + " — Paged.js Editor";
  triggerRender();
  status.textContent = "Loaded " + meta.name;
  return true;
}

export function closeFolder() {
  // Reset state
  fileSidebar.classList.remove("open");
  btnSave.style.display = "none";
  setFileHandles([]);
  setActiveFileIdx(-1);
  setActiveFileName("");
  setSavedContent("");
  setDirtyFlag(false);
  setStorageMode("local");
  setDirHandle(null);
  gdFolderId = null;
  gdDriveId = null;
  gdFolderName = "";
  gdToken = null;
  document.getElementById("folderIcon").style.display = "none";
  paneFileName.textContent = "Markdown";
  document.title = "Markdown \u2014 Paged.js Editor";

  // Clear persisted state
  localStorage.removeItem("gd_folder_id");
  localStorage.removeItem("gd_drive_id");
  localStorage.removeItem("gd_folder_name");
  sessionStorage.removeItem("gd_token");
  idbSet("dirHandle", null);
  idbSet("activeFile", null);

  // Clean URL
  const url = new URL(location.href);
  url.searchParams.delete("driveFolder");
  url.searchParams.delete("driveFile");
  url.searchParams.delete("file");
  url.searchParams.delete("folder");
  history.replaceState(null, "", url);

  cm.setValue("");
  cm.refresh();
  triggerRender();
}

function pickFolder() {
  return new Promise((resolve) => {
    const s = getGdSettings();
    const myDriveView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMimeTypes("application/vnd.google-apps.folder");
    const sharedDrivesView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setEnableDrives(true)
      .setMimeTypes("application/vnd.google-apps.folder");
    const picker = new google.picker.PickerBuilder()
      .addView(myDriveView)
      .addView(sharedDrivesView)
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .setDeveloperKey(s.apiKey)
      .setOAuthToken(gdToken)
      .setTitle("Select a folder with Markdown files")
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ id: doc.id, name: doc.name, driveId: doc.driveId || null });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

function pickFile() {
  return new Promise((resolve) => {
    const s = getGdSettings();
    const docsView = new google.picker.DocsView()
      .setIncludeFolders(false)
      .setMimeTypes("text/markdown,text/plain");
    const sharedView = new google.picker.DocsView()
      .setIncludeFolders(false)
      .setEnableDrives(true)
      .setMimeTypes("text/markdown,text/plain");
    const picker = new google.picker.PickerBuilder()
      .addView(docsView)
      .addView(sharedView)
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .setDeveloperKey(s.apiKey)
      .setOAuthToken(gdToken)
      .setTitle("Select a Markdown file")
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ id: doc.id, name: doc.name });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

export async function openDriveFile() {
  const s = getGdSettings();
  if (!s.clientId || !s.apiKey) {
    document.getElementById('settingsModal').classList.add('open');
    return;
  }
  await initGapi();
  await getGdToken();

  const picked = await pickFile();
  if (!picked) return;

  showLoading("Loading " + picked.name + "...");
  try {
    const text = await fetchGdFileContent(picked.id);
    cm.setValue(text);
    cm.clearHistory();
    hideLoading();
    document.getElementById("paneFileName").textContent = picked.name;
    document.title = picked.name + " — Paged.js Editor";

    // Update URL
    const url = new URL(location.href);
    url.searchParams.delete("file");
    url.searchParams.delete("driveFolder");
    url.searchParams.set("driveFile", picked.id);
    history.replaceState(null, "", url);

    triggerRender();
    status.textContent = "Loaded " + picked.name;
  } catch(e) {
    hideLoading();
    status.textContent = "Load failed: " + e.message;
    console.error("Drive file open error:", e);
  }
}

async function activateGdFolder(restoreFile) {
  // List .md files in the folder
  const listParams = {
    q: `'${gdFolderId}' in parents and (mimeType='text/markdown' or name contains '.md') and trashed=false`,
    fields: "files(id,name)",
    orderBy: "name",
    pageSize: "100",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  };
  if (gdDriveId) { listParams.corpora = "drive"; listParams.driveId = gdDriveId; }
  else { listParams.corpora = "allDrives"; }
  const resp = await driveApiFetch("files", listParams);
  const entries = resp.files || [];

  folderNameEl.textContent = gdFolderName || "Google Drive";
  document.getElementById("folderIcon").style.display = "inline";
  fileSidebar.classList.add("open");
  btnSave.style.display = "";
  cm.refresh();

  // Build fileHandles-compatible entries (API returns sorted by name via orderBy)
  setFileHandles(entries.map(f => ({ name: f.name, handle: null, gdId: f.id })));
  renderFileList();

  let idx = 0;
  if (restoreFile) {
    const found = fileHandles.findIndex(f => f.name === restoreFile);
    if (found >= 0) idx = found;
  }
  if (fileHandles.length > 0) await openFile(idx);
}

// Fetch file metadata (modifiedTime) from Drive
async function getGdFileModifiedTime(fileId) {
  const resp = await driveApiFetch("files/" + fileId, {
    fields: "modifiedTime",
    supportsAllDrives: "true",
  });
  return resp.modifiedTime;
}

// Fetch file content from Drive
async function fetchGdFileContent(fileId) {
  const dlResp = await fetch("https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media&supportsAllDrives=true", {
    headers: { "Authorization": "Bearer " + gdToken },
  });
  if (!dlResp.ok) throw new Error("Download failed: " + dlResp.status);
  return dlResp.text();
}

// Override openFile and doSave to handle both modes
const _origOpenFile = openFile;
setOpenFile(async function(idx) {
  if (storageMode === "gdrive") {
    if (isDirty()) await doSave();
    setActiveFileIdx(idx);
    const entry = fileHandles[idx];
    setActiveFileName(entry.name);
    showLoading("Loading " + entry.name + "...");
    try {
      const [text, modTime] = await Promise.all([
        fetchGdFileContent(entry.gdId),
        getGdFileModifiedTime(entry.gdId),
      ]);
      gdModifiedTime = modTime;
      setSavedContent(text);
      setDirtyFlag(false);
      cm.setValue(text);
      cm.clearHistory();
      hideLoading();
      paneFileName.textContent = entry.name;
      document.title = entry.name + " — Paged.js Editor";
      renderFileList();
      triggerRender();
      await idbSet("activeFile", entry.name);
      // Keep driveFolder in URL, add active file name
      const url = new URL(location.href);
      if (gdFolderId) url.searchParams.set("driveFolder", gdFolderId);
      history.replaceState(null, "", url);
      status.textContent = "Loaded " + entry.name;
    } catch(e) {
      hideLoading();
      status.textContent = "Load failed: " + e.message;
      console.error("GDrive open error:", e);
    }
  } else {
    await _origOpenFile(idx);
  }
});

const _origDoSave = doSave;
setDoSave(async function() {
  if (storageMode === "gdrive") {
    if (activeFileIdx < 0) return;
    const entry = fileHandles[activeFileIdx];
    status.textContent = "Saving " + entry.name + "...";
    try {
      // Check if file was modified remotely since we loaded it
      if (gdModifiedTime) {
        const currentModTime = await getGdFileModifiedTime(entry.gdId);
        if (currentModTime !== gdModifiedTime) {
          // Conflict! Fetch remote content and show diff
          status.textContent = "Conflict detected — reviewing changes...";
          const remoteText = await fetchGdFileContent(entry.gdId);
          const localText = cm.getValue();
          const action = await showDiffModal(localText, remoteText, entry.name,
            "This file was modified on Google Drive by someone else. Lines prefixed with − are your version, + are the remote version.");
          if (action === "cancel") {
            status.textContent = "Save cancelled";
            return;
          }
          if (action === "reload") {
            // Replace editor with remote version
            gdModifiedTime = currentModTime;
            setSavedContent(remoteText);
            setDirtyFlag(false);
            cm.setValue(remoteText);
            cm.clearHistory();
            renderFileList();
            triggerRender();
            status.textContent = "Loaded remote version of " + entry.name;
            return;
          }
          if (action === "merge") {
            const merged = threeWayMerge(savedContent, localText, remoteText);
            cm.setValue(merged.text);
            if (merged.hasConflicts) {
              status.textContent = "Merged with conflicts — search for <<<<<<< to resolve";
              return;
            }
          }
          // action === "force" or clean merge: fall through to save
        }
      }
      const saveResp = await fetch("https://www.googleapis.com/upload/drive/v3/files/" + entry.gdId + "?uploadType=media&supportsAllDrives=true", {
        method: "PATCH",
        headers: {
          "Authorization": "Bearer " + gdToken,
          "Content-Type": "text/markdown",
        },
        body: cm.getValue(),
      });
      if (!saveResp.ok) throw new Error("Drive API " + saveResp.status + ": " + (await saveResp.text()));
      setSavedContent(cm.getValue());
      setDirtyFlag(false);
      // Update modifiedTime after successful save
      gdModifiedTime = await getGdFileModifiedTime(entry.gdId);
      status.textContent = "Saved " + entry.name;
      renderFileList();
    } catch(e) {
      console.error("GDrive save error:", e);
      status.textContent = "Save failed: " + e.message;
    }
  } else {
    await _origDoSave();
  }
});
