let latestRows = [];
let latestWorkbookB64 = "";
let latestWorkbookFilename = "heron_ar_output.xlsx";
let selectedFiles = [];
let latestOutputColumns = [];

const el = {
  clientsHead: document.querySelector("#clientsTable thead"),
  clientsBody: document.querySelector("#clientsTable tbody"),
  glHead: document.querySelector("#glTable thead"),
  glBody: document.querySelector("#glTable tbody"),
  pdfInput: document.getElementById("pdfInput"),
  clearFilesBtn: document.getElementById("clearFilesBtn"),
  fileListMeta: document.getElementById("fileListMeta"),
  fileListHead: document.querySelector("#fileListTable thead"),
  fileListBody: document.querySelector("#fileListTable tbody"),
  runBtn: document.getElementById("runBtn"),
  status: document.getElementById("status"),
  parsedHead: document.querySelector("#parsedTable thead"),
  parsedBody: document.querySelector("#parsedTable tbody"),
  outputHead: document.querySelector("#outputTable thead"),
  outputBody: document.querySelector("#outputTable tbody"),
  downloadExcelBtn: document.getElementById("downloadExcelBtn"),
};

function setStatus(text) {
  el.status.textContent = text;
}

function renderTable(tableHead, tableBody, rows) {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";
  if (!rows || !rows.length) return;
  const cols = Object.keys(rows[0]);
  const trh = document.createElement("tr");
  cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });
  tableHead.appendChild(trh);
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    cols.forEach((c) => {
      const td = document.createElement("td");
      td.textContent = row[c] ?? "";
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

function fileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function renderSelectedFiles() {
  if (!selectedFiles.length) {
    el.fileListMeta.textContent = "No files selected.";
    el.fileListHead.innerHTML = "";
    el.fileListBody.innerHTML = "";
    return;
  }
  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  el.fileListMeta.textContent = `Selected invoices: ${selectedFiles.length} file(s), ${Math.round(totalBytes / 1024)} KB total`;
  const rows = selectedFiles.map((f, idx) => ({
    "#": idx + 1,
    name: f.name,
    size_kb: (f.size / 1024).toFixed(1),
    type: f.type || "application/pdf",
  }));
  renderTable(el.fileListHead, el.fileListBody, rows);
}

async function loadMappings() {
  const res = await fetch("/api/mappings");
  if (!res.ok) throw new Error(`Mapping load failed (${res.status})`);
  const data = await res.json();
  renderTable(el.clientsHead, el.clientsBody, data.clients || []);
  renderTable(el.glHead, el.glBody, data.gl_mappings || []);
}

function downloadWorkbookFromBase64(base64Data, filename) {
  const bin = atob(base64Data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "heron_ar_output.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildWorkbookInBrowser(rows, columns, filename) {
  if (!window.XLSX) {
    setStatus("Excel export unavailable: XLSX library not loaded.");
    return;
  }
  const useCols = columns && columns.length ? columns : Object.keys(rows[0] || {});
  const outRows = rows.map((r) => {
    const x = {};
    useCols.forEach((c) => {
      x[c] = r[c] ?? "";
    });
    return x;
  });
  const ws = XLSX.utils.json_to_sheet(outRows, { header: useCols });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Layout");
  XLSX.writeFile(wb, filename || "heron_ar_output.xlsx");
}

async function runProcess() {
  const files = [...selectedFiles];
  if (!files.length) {
    setStatus("Please select at least one PDF invoice.");
    return;
  }

  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  setStatus(`Uploading ${files.length} file(s) and running Gemini extraction...`);
  const res = await fetch("/api/process", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Process failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const parsed = data.parsed_invoices || [];
  const rows = data.journal_rows || [];
  latestOutputColumns = data.output_columns || [];
  latestWorkbookB64 = data.workbook_base64 || "";
  latestWorkbookFilename = data.workbook_filename || "heron_ar_output.xlsx";

  latestRows = rows;
  renderTable(el.parsedHead, el.parsedBody, parsed);
  renderTable(el.outputHead, el.outputBody, rows);
  el.downloadExcelBtn.disabled = !(rows.length && latestWorkbookB64);

  setStatus(`Done.\nParsed invoices: ${parsed.length}\nOutput rows: ${rows.length}`);
}

el.pdfInput.addEventListener("change", () => {
  const incoming = [...(el.pdfInput.files || [])];
  if (incoming.length) {
    const seen = new Set(selectedFiles.map(fileKey));
    incoming.forEach((file) => {
      const key = fileKey(file);
      if (!seen.has(key)) {
        selectedFiles.push(file);
        seen.add(key);
      }
    });
  }
  // Allow selecting the same file again in a later action after clear.
  el.pdfInput.value = "";
  renderSelectedFiles();
});

el.clearFilesBtn.addEventListener("click", () => {
  selectedFiles = [];
  el.pdfInput.value = "";
  renderSelectedFiles();
  setStatus("Selected file list cleared.");
});

el.runBtn.addEventListener("click", async () => {
  try {
    await runProcess();
  } catch (err) {
    console.error(err);
    setStatus(err.message);
  }
});

el.downloadExcelBtn.addEventListener("click", () => {
  if (!latestRows.length) {
    setStatus("No output available yet. Run processing first.");
    return;
  }
  if (latestWorkbookB64) {
    downloadWorkbookFromBase64(latestWorkbookB64, latestWorkbookFilename);
    return;
  }
  buildWorkbookInBrowser(latestRows, latestOutputColumns, "heron_ar_output_cloudflare.xlsx");
});

async function boot() {
  try {
    const health = await fetch("/api/health").then((r) => r.json());
    await loadMappings();
    setStatus(
      `Ready.\nGemini model: ${health.gemini_model}\nAPI key loaded: ${health.has_api_key ? "yes" : "no"}`
    );
    renderSelectedFiles();
  } catch (err) {
    console.error(err);
    setStatus(`Startup error: ${err.message}`);
  }
}

boot();
