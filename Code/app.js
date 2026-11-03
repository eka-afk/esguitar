
"use strict";

const DEFAULTS = [
  { name: "A", color: "#000000" },
  { name: "A# / Bb", color: "#FFFFFF" },
  { name: "B", color: "#000000" },
  { name: "C", color: "#000000" },
  { name: "C# / Db", color: "#FFFFFF" },
  { name: "D# / Eb", color: "#FFFFFF" },
  { name: "D", color: "#000000" },
  { name: "E", color: "#000000" },
  { name: "F", color: "#000000" },
  { name: "F# / Gb", color: "#FFFFFF" },
  { name: "G", color: "#000000" },
  { name: "G# / Ab", color: "#FFFFFF" }
];
const STORAGE_KEY = "noteColorPicker.v4";

// Pitch classes with C = 0. Names must match the entries in DEFAULTS.
const PC_NAMES = ["C", "C# / Db", "D", "D# / Eb", "E", "F", "F# / Gb", "G", "G# / Ab", "A", "A# / Bb", "B"];
const NOTE_PC = {};
PC_NAMES.forEach((nm, i) => { NOTE_PC[nm] = i; });

// Standard tuning, top row (1st string) to bottom row (6th string).
// w = relative string gauge (px); wire = plain steel or wound brass.
const STRINGS = [
  { label: "1st", sub: "(High E)", pc: 4, w: 1.5, wire: "steel" },
  { label: "2nd", sub: "(B)", pc: 11, w: 2, wire: "steel" },
  { label: "3rd", sub: "(G)", pc: 7, w: 2.5, wire: "steel" },
  { label: "4th", sub: "(D)", pc: 2, w: 3.5, wire: "steel" },
  { label: "5th", sub: "(A)", pc: 9, w: 5, wire: "brass" },
  { label: "6th", sub: "(Low E)", pc: 4, w: 6.5, wire: "brass" }
];
const FRETS = 24;
const MARKERS = { 3: 1, 5: 1, 7: 1, 9: 1, 12: 2, 15: 1, 17: 1, 19: 1, 21: 1, 24: 2 };
const WIRE_COLOR = { steel: "#cfd3db", brass: "#c2984a" };

const rowsEl = document.getElementById("rows");
const board = document.getElementById("board");
let notes = load();
let dragIndex = null;
let viewMode = "fit"; // "fit" = whole neck in view, "zoom" = full size + scroll
let boardRotated = false; // rotate the fretboard 90° (vertical, for mobile)
let fretStart = 0;     // first fret shown (0 = includes the Open column)
let fretEnd = FRETS;   // last fret shown

const SETTINGS_KEY = "noteColorPicker.settings.v3";
const DEFAULT_SETTINGS = { theme: "dark", page: "#000000", board: "#E2C39C", active: "#225B62" };
let settings = loadSettings();
let activeColor = settings.active || "#000000";

// Select notes mode: allows double-clicking to toggle note colors
let selectMode = false;
let selectedNotes = new Set(); // tracks pitch classes that are selected

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(n => ({ name: String(n.name), color: normalizeHex(n.color) || "#CCCCCC" }));
      }
    }
  } catch (e) { /* ignore corrupt storage */ }
  return DEFAULTS.map(n => ({ ...n }));
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch (e) { /* ignore */ }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        theme: (p.theme === "dark" || p.theme === "light") ? p.theme : DEFAULT_SETTINGS.theme,
        page: normalizeHex(p.page) || DEFAULT_SETTINGS.page,
        board: normalizeHex(p.board) || DEFAULT_SETTINGS.board,
        active: normalizeHex(p.active) || DEFAULT_SETTINGS.active
      };
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

// Small color helpers to derive section colors from the page color.
function hexToRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function lumaOf(hex) {
  const rgb = hexToRgb(hex);
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

function applySettings() {
  const page = normalizeHex(settings.page) || "#F4F6FB";
  const dark = lumaOf(page) < 0.5;
  const contrast = dark ? "#ffffff" : "#000000";
  const text = dark ? "#f0f2f8" : "#15171f";
  const s = document.documentElement.style;
  s.setProperty("--page", page);
  s.setProperty("--panel", page);
  s.setProperty("--panel-2", mix(page, contrast, 0.06));
  s.setProperty("--border", mix(page, contrast, 0.18));
  s.setProperty("--hover", mix(page, contrast, 0.12));
  s.setProperty("--text", text);
  s.setProperty("--muted", mix(text, page, 0.45));
  s.setProperty("--btn", dark ? mix(page, "#ffffff", 0.12) : "#ffffff");
  s.setProperty("--btn-hover", dark ? mix(page, "#ffffff", 0.20) : "#eef0f6");
  s.setProperty("--wood", settings.board);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  const pc = document.getElementById("pageColor");
  const bc = document.getElementById("boardColor");
  const tb = document.getElementById("themeToggle");
  if (pc) pc.value = page;
  if (bc) bc.value = settings.board;
  const ac = document.getElementById("activeColor");
  if (ac) ac.value = activeColor;
  if (tb) tb.textContent = dark ? "\u2600\uFE0F Light" : "\uD83C\uDF19 Dark";
  s.setProperty("--active-note", activeColor);
  s.setProperty("--active-note-text", textColorFor(activeColor));
}

function normalizeHex(v) {
  if (typeof v !== "string") return null;
  v = v.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(v)) return "#" + v.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(v)) return "#" + v.split("").map(c => c + c).join("").toUpperCase();
  return null;
}

function textColorFor(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#ffffff";
}

function reorder(from, to) {
  if (from === null || to === null || from === to) return;
  const item = notes.splice(from, 1)[0];
  notes.splice(to, 0, item);
  save();
  render();
}

function attachDrag(el, index) {
  el.draggable = true;
  el.addEventListener("dragstart", e => {
    dragIndex = index;
    el.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  el.addEventListener("dragend", () => {
    el.classList.remove("dragging");
    document.querySelectorAll(".drop-target").forEach(x => x.classList.remove("drop-target"));
  });
  el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("drop-target"); });
  el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
  el.addEventListener("drop", e => {
    e.preventDefault();
    el.classList.remove("drop-target");
    reorder(dragIndex, index);
  });
}

function renderRows() {
  if (!rowsEl) return;
  rowsEl.innerHTML = "";
  notes.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "row";

    const handle = document.createElement("div");
    handle.className = "handle";
    handle.textContent = "\u283F";
    handle.title = "Drag to reorder";

    const name = document.createElement("div");
    name.className = "note-name";
    name.textContent = n.name;

    const color = document.createElement("input");
    color.type = "color";
    color.value = n.color;

    const hex = document.createElement("input");
    hex.type = "text";
    hex.className = "hex";
    hex.value = n.color;
    hex.maxLength = 7;

    color.addEventListener("input", () => {
      n.color = color.value.toUpperCase();
      hex.value = n.color;
      save();
      paintColors();
    });
    hex.addEventListener("change", () => {
      const norm = normalizeHex(hex.value);
      if (norm) { n.color = norm; color.value = norm; hex.value = norm; save(); paintColors(); }
      else { hex.value = n.color; }
    });

    const move = document.createElement("div");
    move.className = "move";
    const up = document.createElement("button");
    up.textContent = "\u2191"; up.title = "Move up"; up.disabled = i === 0;
    up.addEventListener("click", () => reorder(i, i - 1));
    const down = document.createElement("button");
    down.textContent = "\u2193"; down.title = "Move down"; down.disabled = i === notes.length - 1;
    down.addEventListener("click", () => reorder(i, i + 1));
    move.appendChild(up);
    move.appendChild(down);

    attachDrag(row, i);

    row.appendChild(handle);
    row.appendChild(name);
    row.appendChild(color);
    row.appendChild(hex);
    row.appendChild(move);
    rowsEl.appendChild(row);
  });
}

function el(tag, text) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
}

function noteBadge(pc, stringIndex, fret) {
  const name = PC_NAMES[pc];
  const b = document.createElement("div");
  b.className = "note-badge";
  b.dataset.pc = pc;

  // Create unique ID for this specific note position
  const noteId = `s${stringIndex}_f${fret}`;
  b.dataset.noteId = noteId;

  const inSet = currentSet && currentSet.has(pc);
  // Ring the root note when emphasis is on and this note is the root.
  if (rootEmphasis && currentRoot !== null && pc === currentRoot && inSet) {
    b.classList.add("is-root");
  }

  // Degree labels (R, 2, b3, 5...) when enabled and a root is set.
  if (labelMode === "degrees" && currentRoot !== null && inSet) {
    const interval = ((pc - currentRoot) % 12 + 12) % 12;
    const s = el("span", DEGREE_LABELS[interval]);
    s.className = "nat";
    b.appendChild(s);
    // Add double-click handler for select mode
    if (selectMode) {
      b.addEventListener("dblclick", () => toggleSelectNote(noteId));
      b.style.cursor = "pointer";
    }
    return b;
  }

  if (name.indexOf(" / ") >= 0) {
    const parts = name.split(" / ");
    const a = el("span", parts[0]); a.className = "acc";
    const c = el("span", parts[1]); c.className = "acc";
    b.appendChild(a); b.appendChild(c);
  } else {
    const s = el("span", name); s.className = "nat";
    b.appendChild(s);
  }

  // Add double-click handler for select mode
  if (selectMode) {
    b.addEventListener("dblclick", () => toggleSelectNote(noteId));
    b.style.cursor = "pointer";
  }

  return b;
}

// The frets to render. The Open (0) column is always shown at its place,
// even when a custom range starts higher up the neck.
function fretList() {
  const list = [];
  if (fretStart > 0) list.push(0);
  for (let f = fretStart; f <= fretEnd; f++) list.push(f);
  return list;
}

// A row of fret-position marker dots (used above and below the board).
function markerRow() {
  const tr = el("tr");
  tr.className = "markers";
  tr.appendChild(el("td"));
  fretList().forEach(f => {
    const td = el("td");
    if (MARKERS[f]) {
      for (let d = 0; d < MARKERS[f]; d++) {
        const dot = el("div");
        dot.className = "inlay";
        td.appendChild(dot);
      }
    }
    tr.appendChild(td);
  });
  return tr;
}

function renderFretboard() {
  board.innerHTML = "";
  const table = el("table");
  table.className = "fretboard";

  const thead = el("thead");
  const htr = el("tr");
  htr.appendChild(el("th"));
  fretList().forEach(f => htr.appendChild(el("th", f === 0 ? "Open" : String(f))));
  thead.appendChild(htr);
  thead.appendChild(markerRow());
  table.appendChild(thead);

  const tbody = el("tbody");
  STRINGS.forEach((s, si) => {
    const tr = el("tr");
    tr.style.setProperty("--str-w", s.w + "px");
    tr.style.setProperty("--str-c", WIRE_COLOR[s.wire]);
    const lbl = el("td");
    lbl.className = "str-label";
    lbl.appendChild(document.createTextNode(s.label + " "));
    lbl.appendChild(el("small", s.sub));
    tr.appendChild(lbl);
    fretList().forEach(f => {
      const td = el("td");
      td.className = "fret-cell " + (f === 0 ? "open" : "wood");
      if (f === 1) td.classList.add("nut");
      else if (f > 1) td.classList.add("fret-line");
      const pc = (s.pc + f) % 12;
      if (!currentSet || currentSet.has(pc) || showInactiveNotes) {
        td.appendChild(noteBadge(pc, si, f));
      }
      const m = MARKERS[f];
      const inlayHere = (m === 1 && si === 3) || (m === 2 && (si === 2 || si === 4));
      if (f >= 1 && inlayHere) {
        const dot = el("div");
        dot.className = "fret-inlay";
        td.appendChild(dot);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const tfoot = el("tfoot");
  tfoot.appendChild(markerRow());
  table.appendChild(tfoot);

  board.appendChild(table);
  fitBoard();
}

// Scale the fretboard down so all 24 frets are visible without scrolling.
function fitBoard() {
  const table = board.querySelector("table");
  if (!table) return;
  const natW = table.offsetWidth;
  const natH = table.offsetHeight;
  if (!natW || !natH) return;
  const avail = board.clientWidth;
  if (!avail) return;

  table.style.transformOrigin = "top left";

  if (boardRotated) {
    // Rotate 90° clockwise. The board's height becomes its visual width.
    const s = viewMode === "zoom" ? 1 : Math.min(avail / natH, 1);
    const visualWidth = s * natH;
    const centerOffset = Math.max(0, (avail - visualWidth) / 2);
    table.style.transform = "translateX(" + (visualWidth + centerOffset) + "px) rotate(90deg) scale(" + s + ")";
    board.style.height = (s * natW) + "px";
    return;
  }

  if (viewMode === "zoom") {
    // Show the board at full size and let the container scroll horizontally.
    table.style.transform = "none";
    board.style.height = "";
    return;
  }
  const scale = Math.min(1, avail / natW);
  table.style.transform = scale < 1 ? "scale(" + scale + ")" : "none";
  board.style.height = (natH * scale) + "px";
}

function paintColors() {
  const map = {};
  notes.forEach(n => { const pc = NOTE_PC[n.name]; if (pc !== undefined) map[pc] = n.color; });
  document.querySelectorAll("[data-pc]").forEach(elm => {
    const pc = Number(elm.dataset.pc);
    let c;
    if (selectMode) {
      // In select mode: selected notes get the active color, others are white
      const noteId = elm.dataset.noteId;
      c = selectedNotes.has(noteId) ? activeColor : "#FFFFFF";
    } else if (currentSet) {
      c = currentSet.has(pc) ? activeColor : "#FFFFFF";
    } else {
      c = map[pc] || "#CCCCCC";
    }
    elm.style.background = c;
    elm.style.color = textColorFor(c);
  });
}

function render() {
  renderRows();
  renderFretboard();
  paintColors();
}

// Convert HSL (h 0-360, s/l 0-100) to a #RRGGBB hex string.
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return ("#" + f(0) + f(8) + f(4)).toUpperCase();
}

// Circle of fifths order (pitch classes) and the set of natural notes.
const CIRCLE5 = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; // C G D A E B F# C# G# D# A# F
const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);

// Each sharp shares the hue of the natural it is derived from (C# -> C, D# -> D, ...).
const PARENT = { 0: 0, 1: 0, 2: 2, 3: 2, 4: 4, 5: 5, 6: 5, 7: 7, 8: 7, 9: 9, 10: 9, 11: 11 };
const NAT_ORDER = [0, 7, 2, 9, 4, 11, 5]; // naturals by circle of fifths: C G D A E B F
const NAT_HUE = {};
NAT_ORDER.forEach((pc, i) => { NAT_HUE[pc] = Math.round(i * 360 / 7); });

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

// Scales and modes, as semitone offsets from the root.
const SCALES = [
  { id: "major", name: "Major (Ionian)", steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: "naturalMinor", name: "Natural minor (Aeolian)", steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: "pentaMajor", name: "Major pentatonic", steps: [0, 2, 4, 7, 9] },
  { id: "pentaMinor", name: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
  { id: "blues", name: "Blues", steps: [0, 3, 5, 6, 7, 10] },
  { id: "dorian", name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: "phrygian", name: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", name: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: "mixolydian", name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: "harmonicMinor", name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: "melodicMinor", name: "Melodic minor", steps: [0, 2, 3, 5, 7, 9, 11] }
];

// Chords, as semitone offsets from the root.
const CHORDS = [
  { id: "major", name: "Major", steps: [0, 4, 7] },
  { id: "minor", name: "Minor", steps: [0, 3, 7] },
  { id: "dom7", name: "Dominant 7", steps: [0, 4, 7, 10] },
  { id: "maj7", name: "Major 7", steps: [0, 4, 7, 11] },
  { id: "min7", name: "Minor 7", steps: [0, 3, 7, 10] },
  { id: "dim", name: "Diminished", steps: [0, 3, 6] },
  { id: "dim7", name: "Diminished 7", steps: [0, 3, 6, 9] },
  { id: "aug", name: "Augmented", steps: [0, 4, 8] },
  { id: "sus2", name: "Sus2", steps: [0, 2, 7] },
  { id: "sus4", name: "Sus4", steps: [0, 5, 7] },
  { id: "add9", name: "Add9", steps: [0, 4, 7, 14 % 12] },
  { id: "six", name: "6th", steps: [0, 4, 7, 9] }
];

// Interval (semitones from root) -> scale-degree label.
const DEGREE_LABELS = ["R", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];

const SHARPS = new Set([1, 3, 6, 8, 10]);

// Pitch classes currently highlighted (null = highlight system not engaged yet).
let currentSet = null;
let currentRoot = null;   // root pitch class when a scale/chord is shown
let showInactiveNotes = false;
let labelMode = "names";  // "names" or "degrees"
let rootEmphasis = false;  // ring the root note when enabled

// Highlighting is a display state; it must not overwrite saved note colors.
function paintHighlight() {
  if (!currentSet) return;
  render();
}

function setHighlight(set, btn, root, showInactive = false) {
  selectMode = false;
  selectedNotes.clear();
  currentSet = set instanceof Set ? set : new Set(set);
  currentRoot = (root === undefined) ? null : root;
  showInactiveNotes = showInactive;
  paintHighlight();
  setActive(btn);
}

// Enter "Select notes" mode - fretboard has no color initially
function enterSelectMode(btn) {
  selectMode = true;
  currentSet = null;
  currentRoot = null;
  showInactiveNotes = false;
  selectedNotes.clear(); // start with no selected notes
  render();
  setActive(btn);
}

// Toggle selection of a specific note position in select mode
function toggleSelectNote(noteId) {
  if (!selectMode) return;
  if (selectedNotes.has(noteId)) {
    selectedNotes.delete(noteId);
  } else {
    selectedNotes.add(noteId);
  }
  paintColors();
}

// Give each natural note its own hue (white text) and each sharp the same
// hue but a lighter tint (black text). Sharps share their parent's color.
function applyColorScheme(btn) {
  selectMode = false; // exit select mode when using other modes
  currentSet = null; // disengage the single-color highlight system
  currentRoot = null;
  showInactiveNotes = false;
  notes.forEach(n => {
    const pc = NOTE_PC[n.name];
    if (pc === undefined) return;
    const hue = NAT_HUE[PARENT[pc]];
    // Each sharp shares the exact same color as its parent natural note.
    n.color = hslToHex(hue, 72, 47);
  });
  save();
  render();
  setActive(btn);
}

// Pitch classes for a set of semitone steps rooted at rootPc.
function stepsToSet(rootPc, steps) {
  return new Set(steps.map(s => (rootPc + s) % 12));
}

function slug(name) {
  return name.toLowerCase()
    .replace(/#/g, "sharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function toJson() { return JSON.stringify(notes, null, 2); }
function toCss() {
  return ":root {\n" + notes.map(n => "  --note-" + slug(n.name) + ": " + n.color + ";").join("\n") + "\n}";
}

function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2b3255;color:#fff;padding:10px 18px;border-radius:10px;border:1px solid #3a4270;z-index:9999;font:14px system-ui;";
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity .4s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 1200);
}
function copy(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast("Copied!"), () => toast("Copy failed"));
  } else {
    toast("Clipboard not available");
  }
}

function setActive(btn) {
  document.querySelectorAll(".colorbtn.active").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

// Drive the active-button color from the current highlight color.
function refreshActiveBtnColor() {
  const s = document.documentElement.style;
  s.setProperty("--active-note", activeColor);
  s.setProperty("--active-note-text", textColorFor(activeColor));
}

document.getElementById("btnReset").addEventListener("click", resetAll);

const btnNone = document.getElementById("btnNone");
const btnNatural = document.getElementById("btnNatural");
const btnSharp = document.getElementById("btnSharp");
btnNone.addEventListener("click", () => { clearExplorer(); showNoneMode(); });
btnNatural.addEventListener("click", () => { clearExplorer(); setHighlight(NATURALS, btnNatural, undefined, true); });
btnSharp.addEventListener("click", () => { clearExplorer(); setHighlight(SHARPS, btnSharp, undefined, true); });
const btnColorful = document.getElementById("btnColorful");
btnColorful.addEventListener("click", () => { clearExplorer(); applyColorScheme(btnColorful); });

const btnSelectNotes = document.getElementById("btnSelectNotes");
btnSelectNotes.addEventListener("click", () => { clearExplorer(); enterSelectMode(btnSelectNotes); });

document.getElementById("activeColor").addEventListener("input", e => {
  activeColor = e.target.value.toUpperCase();
  settings.active = activeColor;
  saveSettings();
  if (currentSet) paintHighlight();
  else paintColors();
  refreshActiveBtnColor();
});

document.getElementById("pageColor").addEventListener("input", e => {
  settings.page = e.target.value.toUpperCase();
  saveSettings();
  applySettings();
});
document.getElementById("boardColor").addEventListener("input", e => {
  settings.board = e.target.value.toUpperCase();
  document.documentElement.style.setProperty("--wood", settings.board);
  saveSettings();
});
document.getElementById("themeToggle").addEventListener("click", () => {
  const goLight = lumaOf(normalizeHex(settings.page) || "#000000") < 0.5;
  settings.page = goLight ? "#F4F6FB" : "#000000";
  settings.theme = goLight ? "light" : "dark";
  saveSettings();
  applySettings();
});

const rootSel = document.getElementById("rootNote");
// Order the root dropdown starting from A (A, A#/Bb, B, C, ...).
const ROOT_ORDER = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8];
ROOT_ORDER.forEach(i => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = PC_NAMES[i];
  rootSel.appendChild(opt);
});

const explorerType = document.getElementById("explorerType");
const explorerDef = document.getElementById("explorerDef");
const btnClearExplorer = document.getElementById("btnClearExplorer");
const btnLabelNames = document.getElementById("btnLabelNames");
const btnLabelDegrees = document.getElementById("btnLabelDegrees");
const btnRootEmph = document.getElementById("btnRootEmph");

// Populate the scale/chord dropdown based on the selected type.
function fillExplorerDef() {
  const showDef = explorerType.value === "scale" || explorerType.value === "chord";
  explorerDef.classList.toggle("hidden", !showDef);
  if (!showDef) {
    explorerDef.innerHTML = "";
    return;
  }
  const list = explorerType.value === "chord" ? CHORDS : SCALES;
  explorerDef.innerHTML = "";
  list.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    explorerDef.appendChild(opt);
  });
}
fillExplorerDef();

function clearExplorer() {
  explorerType.value = "none";
  fillExplorerDef();
}

function showNoneMode() {
  setHighlight(new Set(), btnNone, undefined, true);
}

// Apply the currently selected root + scale/chord to the fretboard.
function applyExplorer() {
  if (explorerType.value === "none") {
    showNoneMode();
    return;
  }
  if (explorerType.value === "noteOnly") {
    const root = Number(rootSel.value);
    setHighlight(new Set([root]), null, root);
    return;
  }
  const list = explorerType.value === "chord" ? CHORDS : SCALES;
  const def = list.find(x => x.id === explorerDef.value) || list[0];
  const root = Number(rootSel.value);
  setHighlight(stepsToSet(root, def.steps), null, root);
}

explorerType.addEventListener("change", () => { fillExplorerDef(); applyExplorer(); });
explorerDef.addEventListener("change", applyExplorer);
rootSel.addEventListener("change", applyExplorer);
btnClearExplorer.addEventListener("click", () => {
  explorerType.value = "none";
  fillExplorerDef();
  showNoneMode();
});

// Label mode: note names vs. scale degrees.
function setLabelMode(mode) {
  labelMode = mode;
  btnLabelNames.classList.toggle("active", mode === "names");
  btnLabelDegrees.classList.toggle("active", mode === "degrees");
  render();
}
btnLabelNames.addEventListener("click", () => setLabelMode("names"));
btnLabelDegrees.addEventListener("click", () => setLabelMode("degrees"));

// Root emphasis toggle.
btnRootEmph.addEventListener("click", () => {
  rootEmphasis = !rootEmphasis;
  btnRootEmph.classList.toggle("active", rootEmphasis);
  render();
});

const btnFit = document.getElementById("btnFit");
const btnZoom = document.getElementById("btnZoom");
function setViewMode(mode) {
  viewMode = mode;
  const zoom = mode === "zoom";
  board.classList.toggle("scrollable", zoom);
  btnZoom.classList.toggle("active", zoom);
  btnFit.classList.toggle("active", !zoom);
  fitBoard();
}
btnFit.addEventListener("click", () => setViewMode("fit"));
btnZoom.addEventListener("click", () => setViewMode("zoom"));

const btnRotate = document.getElementById("btnRotate");
btnRotate.addEventListener("click", () => {
  boardRotated = !boardRotated;
  btnRotate.classList.toggle("active", boardRotated);
  fitBoard();
});

// Fret-range selection: 2 octaves, 1 octave, or a custom start/end range.
const btnRange2 = document.getElementById("btnRange2");
const btnRange1 = document.getElementById("btnRange1");
const btnRangeCustom = document.getElementById("btnRangeCustom");
const rangeCustomWrap = document.getElementById("rangeCustomWrap");
const fretStartSel = document.getElementById("fretStartSel");
const fretEndSel = document.getElementById("fretEndSel");
const boardTitle = document.getElementById("boardTitle");

// Populate the custom start/end fret dropdowns (0 = Open .. 24).
for (let f = 0; f <= FRETS; f++) {
  const o1 = document.createElement("option");
  o1.value = f; o1.textContent = f === 0 ? "Open" : f;
  fretStartSel.appendChild(o1);
  const o2 = document.createElement("option");
  o2.value = f; o2.textContent = f === 0 ? "Open" : f;
  fretEndSel.appendChild(o2);
}
fretStartSel.value = "0";
fretEndSel.value = String(FRETS);

function setRange(start, end, activeBtn, showCustom) {
  fretStart = start;
  fretEnd = end;
  if (start === 0 && end === FRETS) {
    boardTitle.textContent = "Guitar Fretboard — 2 Octaves (24 Frets)";
  } else if (start === 0 && end === 12) {
    boardTitle.textContent = "Guitar Fretboard — 1 Octave (12 Frets)";
  } else {
    boardTitle.textContent = `Guitar Fretboard — Frets ${start}–${end}`;
  }
  [btnRange2, btnRange1, btnRangeCustom].forEach(b => b.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
  rangeCustomWrap.classList.toggle("hidden", !showCustom);
  render();
}
btnRange2.addEventListener("click", () => setRange(0, FRETS, btnRange2, false));
btnRange1.addEventListener("click", () => setRange(0, 12, btnRange1, false));
btnRangeCustom.addEventListener("click", () => {
  setRange(Number(fretStartSel.value), Number(fretEndSel.value), btnRangeCustom, true);
});
function applyCustomRange() {
  let start = Number(fretStartSel.value);
  let end = Number(fretEndSel.value);
  if (start > end) { // keep the two selects consistent
    end = start;
    fretEndSel.value = String(end);
  }
  setRange(start, end, btnRangeCustom, true);
}
fretStartSel.addEventListener("change", applyCustomRange);
fretEndSel.addEventListener("change", applyCustomRange);

function resetAll() {
  notes = DEFAULTS.map(n => ({ ...n }));
  settings = { ...DEFAULT_SETTINGS };
  activeColor = settings.active;
  selectMode = false;
  selectedNotes.clear();
  currentSet = new Set();
  currentRoot = null;
  showInactiveNotes = true;
  labelMode = "names";
  rootEmphasis = false;
  viewMode = "fit";
  boardRotated = false;
  fretStart = 0;
  fretEnd = FRETS;

  rootSel.value = "9";
  clearExplorer();
  fretStartSel.value = "0";
  fretEndSel.value = String(FRETS);
  rangeCustomWrap.classList.add("hidden");
  boardTitle.textContent = "Guitar Fretboard — 2 Octaves (24 Frets)";
  board.classList.remove("scrollable");
  board.scrollLeft = 0;
  btnRotate.classList.remove("active");
  btnZoom.classList.remove("active");
  btnFit.classList.add("active");
  btnRange1.classList.remove("active");
  btnRangeCustom.classList.remove("active");
  btnRange2.classList.add("active");
  btnLabelDegrees.classList.remove("active");
  btnRootEmph.classList.remove("active");
  btnLabelNames.classList.add("active");
  setActive(btnNone);

  saveSettings();
  save();
  applySettings();
  refreshActiveBtnColor();
  render();
}

applySettings();
window.addEventListener("resize", fitBoard);
render();
// Default the "Show notes" mode to None on load.
showNoneMode();
