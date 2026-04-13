// cover-form.js — Form-based editor for the Cover tab (project.json).
// Replaces raw JSON editing with a structured form UI.

import { cm } from "./codemirror-editor.js";
import { normalizeLogoEntry, normalizeProjectData } from "../document/model/memoire-views.js";
import { writeBinaryFile } from "../infrastructure/platform-adapter.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const LOGO_KEYS = ["candidat", "partenaire", "acheteur"];
const DEBOUNCE_MS = 300;

// Preset source buttons per logo key. Keys without entries get plain choose/remove UI.
const LOGO_PRESETS = {
  candidat: [{ label: "BEORN", file: "assets/beorn-logo.png" }],
  partenaire: [
    { label: "Liferay", file: "assets/liferay-logo.svg" },
    { label: "LumApps", file: "assets/lumapps-logo.svg" },
  ],
};

// ── Module state ──────────────────────────────────────────────────────────────

let container = null;
let formBuilt = false;
let _syncing = false;
let debounceTimer = null;
let _onRender = null;
let _onDirty = null;
let _patchPreview = null;

export function setOnRender(fn) {
  _onRender = fn;
}

export function setOnDirty(fn) {
  _onDirty = fn;
}

export function setOnPatchPreview(fn) {
  _patchPreview = fn;
}

// ── DOM references (populated in buildCoverFormDom) ───────────────────────────

const refs = {
  title: null,
  doctype: null,
  ref: null,
  acheteur: null,
  candidat: null,
  confidential: null,
  logos: {},
};

// ── Public API ────────────────────────────────────────────────────────────────

export function showCoverForm() {
  ensureFormDom();
  container.classList.add("visible");
  const cmWrapper = cm.getWrapperElement();
  if (cmWrapper) cmWrapper.style.display = "none";
}

export function hideCoverForm() {
  if (container) container.classList.remove("visible");
  const cmWrapper = cm.getWrapperElement();
  if (cmWrapper) cmWrapper.style.display = "";
}

export function isCoverFormVisible() {
  return container !== null && container.classList.contains("visible");
}

export function populateCoverForm(jsonString) {
  ensureFormDom();
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch {
    data = {};
  }

  refs.title.value = String(data.title ?? "");
  refs.doctype.value = String(data.doctype ?? "");
  refs.ref.value = String(data.ref ?? data.reference ?? data.ao_ref ?? "");
  refs.acheteur.value = String(data.acheteur ?? data.client ?? "");
  refs.candidat.value = String(data.candidat ?? "");
  refs.confidential.checked = data.confidential ?? true;

  const logos = data.logos || {};
  for (const key of LOGO_KEYS) {
    const entry = normalizeLogoEntry(logos[key], key);
    const r = refs.logos[key];
    r.file = entry.file;
    r._dataUrl = null;
    r.showInCover.checked = entry.showInCover;
    r.coverWidth.value = entry.coverWidth;
    r.coverX.value = entry.coverX;
    r.coverY.value = entry.coverY;
    r.showInFooter.checked = entry.showInFooter;
    r.footerWidth.value = entry.footerWidth;
    r.footerX.value = entry.footerX;
    r.footerY.value = entry.footerY;
    if (LOGO_PRESETS[key]) syncSourceToggle(key);
    updateLogoPreview(key);
    updateSliderValues(key);
    toggleSliders(key);
  }
}

export function serializeCoverForm() {
  const data = {
    title: refs.title.value,
    doctype: refs.doctype.value,
    ref: refs.ref.value,
    acheteur: refs.acheteur.value,
    candidat: refs.candidat.value,
    confidential: refs.confidential.checked,
    logos: {},
  };

  for (const key of LOGO_KEYS) {
    const r = refs.logos[key];
    data.logos[key] = {
      file: r.file,
      showInCover: r.showInCover.checked,
      coverWidth: Number(r.coverWidth.value),
      coverX: Number(r.coverX.value),
      coverY: Number(r.coverY.value),
      showInFooter: r.showInFooter.checked,
      footerWidth: Number(r.footerWidth.value),
      footerX: Number(r.footerX.value),
      footerY: Number(r.footerY.value),
    };
  }

  return JSON.stringify(data, null, 2) + "\n";
}

export function syncCoverFormToEditor() {
  const data = serializeCoverForm();
  _syncing = true;
  try {
    cm.setValue(data);
  } finally {
    _syncing = false;
  }
  const patched = _patchPreview?.(normalizeProjectData(JSON.parse(data)));
  if (!patched && _onRender) _onRender();
}

export function isSyncing() {
  return _syncing;
}

// ── DOM construction ──────────────────────────────────────────────────────────

function ensureFormDom() {
  if (formBuilt) return;
  buildCoverFormDom();
  formBuilt = true;
}

function buildCoverFormDom() {
  container = document.createElement("div");
  container.className = "cover-form-container";

  const inner = document.createElement("div");
  inner.className = "cover-form-inner";

  const heading = document.createElement("h2");
  heading.textContent = "Cover Page Settings";
  inner.appendChild(heading);

  // ── Document Information section ──
  const docSection = createSection("Document Information");

  refs.title = createTextarea(
    "Title",
    "Document title\nLine breaks supported",
    3,
  );
  docSection.appendChild(refs.title.closest(".cover-form-field"));

  refs.doctype = createTextField("Document Type", "Memoire technique");
  docSection.appendChild(refs.doctype.closest(".cover-form-field"));

  const row = document.createElement("div");
  row.className = "cover-form-row";
  refs.ref = createTextField("Reference", "");
  refs.acheteur = createTextField("Acheteur", "");
  row.appendChild(refs.ref.closest(".cover-form-field"));
  row.appendChild(refs.acheteur.closest(".cover-form-field"));
  docSection.appendChild(row);

  refs.candidat = createTextField("Candidat", "BEORN Technologies");
  docSection.appendChild(refs.candidat.closest(".cover-form-field"));

  const confidentialCheckbox = createCheckbox("Confidential document");
  refs.confidential = confidentialCheckbox.querySelector("input");
  docSection.appendChild(confidentialCheckbox);

  inner.appendChild(docSection);

  // ── Logos section ──
  const logoSection = createSection("Logos");

  for (const key of LOGO_KEYS) {
    const card = buildLogoCard(key);
    logoSection.appendChild(card);
  }

  inner.appendChild(logoSection);

  container.appendChild(inner);

  const editorWrapper = document.getElementById("editor-wrapper");
  if (editorWrapper) {
    editorWrapper.appendChild(container);
  }
}

// ── Field builders ────────────────────────────────────────────────────────────

function createSection(title) {
  const section = document.createElement("div");
  section.className = "cover-form-section";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  section.appendChild(h3);
  return section;
}

function createTextField(labelText, placeholder) {
  const field = document.createElement("div");
  field.className = "cover-form-field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder || "";
  input.addEventListener("input", scheduleSyncToEditor);
  field.appendChild(label);
  field.appendChild(input);
  return input;
}

function createTextarea(labelText, placeholder, rows) {
  const field = document.createElement("div");
  field.className = "cover-form-field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const textarea = document.createElement("textarea");
  textarea.rows = rows || 3;
  textarea.placeholder = placeholder || "";
  textarea.addEventListener("input", scheduleSyncToEditor);
  field.appendChild(label);
  field.appendChild(textarea);
  return textarea;
}

function createCheckbox(labelText) {
  const wrapper = document.createElement("label");
  wrapper.className = "cover-form-checkbox";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.addEventListener("change", scheduleSyncToEditor);
  const span = document.createElement("span");
  span.textContent = labelText;
  wrapper.appendChild(input);
  wrapper.appendChild(span);
  return wrapper;
}

// ── Logo card builder ─────────────────────────────────────────────────────────

function buildLogoCard(key) {
  const card = document.createElement("div");
  card.className = "cover-form-logo-card";

  const h4 = document.createElement("h4");
  h4.textContent = "Logo " + capitalize(key);
  card.appendChild(h4);

  // Preview area
  const previewArea = document.createElement("div");
  previewArea.className = "cover-form-logo-preview-area";

  const placeholder = document.createElement("div");
  placeholder.className = "cover-form-logo-placeholder";
  placeholder.textContent = "No file";

  const img = document.createElement("img");
  img.style.display = "none";
  img.alt = "Logo " + capitalize(key);

  const actions = document.createElement("div");
  actions.className = "cover-form-logo-actions";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const destPath = "assets/" + key + "-" + file.name;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      writeBinaryFile(destPath, base64).catch((e) => {
        console.error("Failed to upload logo:", e);
      });

      refs.logos[key].file = destPath;
      refs.logos[key]._dataUrl = reader.result;
      if (LOGO_PRESETS[key]) syncSourceToggle(key);
      updateLogoPreview(key);
      scheduleSyncToEditor();
    };
    reader.readAsDataURL(file);
  });

  const presets = LOGO_PRESETS[key];
  let removeBtn = null;
  if (presets) {
    // Preset toggle buttons + upload option
    for (const preset of presets) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = preset.label;
      btn.className = "logo-source-btn";
      btn.dataset.presetFile = preset.file;
      btn.addEventListener("click", () => {
        refs.logos[key].file = preset.file;
        refs.logos[key]._dataUrl = null;
        fileInput.value = "";
        syncSourceToggle(key);
        updateLogoPreview(key);
        scheduleSyncToEditor();
      });
      actions.appendChild(btn);
    }

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.textContent = "Upload...";
    uploadBtn.className = "logo-source-btn";
    uploadBtn.dataset.presetFile = "";
    uploadBtn.addEventListener("click", () => fileInput.click());
    actions.appendChild(uploadBtn);
    actions.appendChild(fileInput);
  } else {
    const chooseBtn = document.createElement("button");
    chooseBtn.type = "button";
    chooseBtn.textContent = "Choose file...";
    chooseBtn.addEventListener("click", () => fileInput.click());

    removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.className = "remove-btn";
    removeBtn.style.display = "none";
    removeBtn.addEventListener("click", () => {
      refs.logos[key].file = "";
      fileInput.value = "";
      updateLogoPreview(key);
      scheduleSyncToEditor();
    });

    actions.appendChild(chooseBtn);
    actions.appendChild(removeBtn);
    actions.appendChild(fileInput);
  }

  previewArea.appendChild(placeholder);
  previewArea.appendChild(img);
  previewArea.appendChild(actions);
  card.appendChild(previewArea);

  // Logo options
  const options = document.createElement("div");
  options.className = "cover-form-logo-options";

  // Cover settings
  const coverCheckRow = document.createElement("label");
  coverCheckRow.className = "cover-form-checkbox-row";
  const coverCheck = document.createElement("input");
  coverCheck.type = "checkbox";
  const coverSpan = document.createElement("span");
  coverSpan.textContent = "Show in cover";
  coverCheckRow.appendChild(coverCheck);
  coverCheckRow.appendChild(coverSpan);
  options.appendChild(coverCheckRow);

  const coverSliders = document.createElement("div");
  coverSliders.className = "cover-form-sliders";
  const coverWidth = buildSliderRow("Width", 20, 400, 5, 180);
  const coverX = buildSliderRow("X offset", -200, 200, 1, 0);
  const coverY = buildSliderRow("Y offset", -200, 200, 1, 0);
  coverSliders.appendChild(coverWidth.row);
  coverSliders.appendChild(coverX.row);
  coverSliders.appendChild(coverY.row);
  options.appendChild(coverSliders);

  coverCheck.addEventListener("change", () => {
    toggleSliders(key);
    scheduleSyncToEditor();
  });

  // Footer settings
  const footerCheckRow = document.createElement("label");
  footerCheckRow.className = "cover-form-checkbox-row";
  const footerCheck = document.createElement("input");
  footerCheck.type = "checkbox";
  const footerSpan = document.createElement("span");
  footerSpan.textContent = "Show in footer";
  footerCheckRow.appendChild(footerCheck);
  footerCheckRow.appendChild(footerSpan);
  options.appendChild(footerCheckRow);

  const footerSliders = document.createElement("div");
  footerSliders.className = "cover-form-sliders";
  const footerWidth = buildSliderRow("Width", 20, 200, 5, 80);
  const footerX = buildSliderRow("X offset", -200, 200, 1, 0);
  const footerY = buildSliderRow("Y offset", -200, 200, 1, 0);
  footerSliders.appendChild(footerWidth.row);
  footerSliders.appendChild(footerX.row);
  footerSliders.appendChild(footerY.row);
  options.appendChild(footerSliders);

  footerCheck.addEventListener("change", () => {
    toggleSliders(key);
    scheduleSyncToEditor();
  });

  card.appendChild(options);

  // Store refs (removeBtn is null for cards that use a preset toggle instead)
  refs.logos[key] = {
    file: "",
    _dataUrl: null,
    img,
    placeholder,
    removeBtn: LOGO_PRESETS[key] ? null : removeBtn,
    fileInput,
    showInCover: coverCheck,
    coverSliders,
    coverWidth: coverWidth.input,
    coverWidthValue: coverWidth.valueEl,
    coverX: coverX.input,
    coverXValue: coverX.valueEl,
    coverY: coverY.input,
    coverYValue: coverY.valueEl,
    showInFooter: footerCheck,
    footerSliders,
    footerWidth: footerWidth.input,
    footerWidthValue: footerWidth.valueEl,
    footerX: footerX.input,
    footerXValue: footerX.valueEl,
    footerY: footerY.input,
    footerYValue: footerY.valueEl,
  };

  return card;
}

function buildSliderRow(labelText, min, max, step, defaultValue) {
  const row = document.createElement("div");
  row.className = "cover-form-slider-row";

  const label = document.createElement("label");
  label.textContent = labelText;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(defaultValue);

  const valueEl = document.createElement("span");
  valueEl.className = "slider-value";
  valueEl.textContent = String(defaultValue);

  input.addEventListener("input", () => {
    valueEl.textContent = input.value;
    scheduleSyncToEditor();
  });

  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(valueEl);

  return { row, input, valueEl };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function syncSourceToggle(key) {
  const r = refs.logos[key];
  const card = r.img.closest(".cover-form-logo-card");
  if (!card) return;
  // A preset button is active when its file matches and no custom upload is pending.
  // The upload button (presetFile === "") is active when r._dataUrl is set or r.file
  // doesn't match any preset.
  const presets = LOGO_PRESETS[key] || [];
  const matchedPreset = !r._dataUrl && presets.find((p) => p.file === r.file);
  card.querySelectorAll(".logo-source-btn").forEach((btn) => {
    const isActive = matchedPreset
      ? btn.dataset.presetFile === matchedPreset.file
      : btn.dataset.presetFile === "";
    btn.classList.toggle("active", isActive);
  });
}

function updateLogoPreview(key) {
  const r = refs.logos[key];
  const url = r._dataUrl || r.file;
  if (url) {
    r.img.src = url;
    r.img.style.display = "";
    r.placeholder.style.display = "none";
    if (r.removeBtn) r.removeBtn.style.display = "";
  } else {
    r.img.style.display = "none";
    r.img.src = "";
    r._dataUrl = null;
    r.placeholder.style.display = "";
    if (r.removeBtn) r.removeBtn.style.display = "none";
  }
}

function updateSliderValues(key) {
  const r = refs.logos[key];
  r.coverWidthValue.textContent = r.coverWidth.value;
  r.coverXValue.textContent = r.coverX.value;
  r.coverYValue.textContent = r.coverY.value;
  r.footerWidthValue.textContent = r.footerWidth.value;
  r.footerXValue.textContent = r.footerX.value;
  r.footerYValue.textContent = r.footerY.value;
}

function toggleSliders(key) {
  const r = refs.logos[key];
  r.coverSliders.classList.toggle("visible", r.showInCover.checked);
  r.footerSliders.classList.toggle("visible", r.showInFooter.checked);
}

function scheduleSyncToEditor() {
  if (_onDirty) _onDirty();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => syncCoverFormToEditor(), DEBOUNCE_MS);
}
