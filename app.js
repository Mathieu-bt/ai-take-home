let latestRows = [];
let latestWorkbookB64 = "";
let latestWorkbookFilename = "heron_ar_output.xlsx";
let selectedFiles = [];
let latestOutputColumns = [];

const SAMPLE_RUN = {
  selectedFiles: [
    {
      name: "AR_Invoice_HERINV-260202_SGD.pdf",
      size: 2696,
      type: "application/pdf",
    },
  ],
  parsedInvoices: [
    {
      invoice_number: "HERINV-260202",
      invoice_date: "10/02/2026",
      due_date: "26/02/2026",
      currency: "SGD",
      customer_name: "Meridian Trade Finance Pte. Ltd.",
      service_type: "Receivables analytics and reporting",
      service_description: "Weekly cash collection dashboard and commentary, Fixed monthly service fee",
      service_period_label: "February 2026",
      net_amount: 7420.0,
      tax_label: "GST 9%",
      tax_amount: 667.8,
      total_amount: 8087.8,
      is_tax_invoice: true,
      confidence: 0.95,
      source_file: "AR_Invoice_HERINV-260202_SGD.pdf",
    },
  ],
  journalRows: [
    {
      upload: "yes",
      voucher_no: 0,
      "GL lookup": "12000",
      trans_type: "AR",
      "GL account name": "Accounts Receivable",
      Client_id_lookup: "CL002",
      Client_name: "Meridian Trade Finance Pte. Ltd.",
      period: "202602",
      Dimension_id_lookup: "",
      Dimension_name: "",
      "Suppl/cust_name": "Meridian Trade Finance Pte. Ltd.",
      inv_ref: "HERINV-260202",
      invoice_date: "20260210",
      currency: "SGD",
      cur_amount: 8087.8,
      description: "Meridian Trade Finance Pte. Ltd. AR 202602",
      notes: "",
    },
    {
      upload: "yes",
      voucher_no: 0,
      "GL lookup": "80004",
      trans_type: "GL",
      "GL account name": "Services performed",
      Client_id_lookup: "CL002",
      Client_name: "Meridian Trade Finance Pte. Ltd.",
      period: "202602",
      Dimension_id_lookup: "P90001415",
      Dimension_name: "J. Lee",
      "Suppl/cust_name": "Meridian Trade Finance Pte. Ltd.",
      inv_ref: "HERINV-260202",
      invoice_date: "20260210",
      currency: "SGD",
      cur_amount: -7420.0,
      description: "Meridian Trade Finance Pte. Ltd. J. Lee 202602",
      notes: "",
    },
    {
      upload: "yes",
      voucher_no: 0,
      "GL lookup": "20045",
      trans_type: "GL",
      "GL account name": "VAT/WHT",
      Client_id_lookup: "CL002",
      Client_name: "Meridian Trade Finance Pte. Ltd.",
      period: "202602",
      Dimension_id_lookup: "",
      Dimension_name: "",
      "Suppl/cust_name": "Meridian Trade Finance Pte. Ltd.",
      inv_ref: "HERINV-260202",
      invoice_date: "20260210",
      currency: "SGD",
      cur_amount: -667.8,
      description: "Meridian Trade Finance Pte. Ltd. Tax 202602",
      notes: "",
    },
  ],
  outputColumns: [
    "upload",
    "voucher_no",
    "GL lookup",
    "trans_type",
    "GL account name",
    "Client_id_lookup",
    "Client_name",
    "period",
    "Dimension_id_lookup",
    "Dimension_name",
    "Suppl/cust_name",
    "inv_ref",
    "invoice_date",
    "currency",
    "cur_amount",
    "description",
    "notes",
  ],
  workbookAssetPath: "./assets/sample-run/Heron_AR_sample_run.xlsx",
  workbookFilename: "Heron_AR_sample_run.xlsx",
  statusText: "Done.\nParsed invoices: 1\nOutput rows: 3",
};

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
  liveProcessingBadge: document.getElementById("liveProcessingBadge"),
  status: document.getElementById("status"),
  parsedHead: document.querySelector("#parsedTable thead"),
  parsedBody: document.querySelector("#parsedTable tbody"),
  outputHead: document.querySelector("#outputTable thead"),
  outputBody: document.querySelector("#outputTable tbody"),
  downloadExcelBtn: document.getElementById("downloadExcelBtn"),
  sampleRun: document.getElementById("sampleRun"),
  sampleFileListMeta: document.getElementById("sampleFileListMeta"),
  sampleFileListHead: document.querySelector("#sampleFileListTable thead"),
  sampleFileListBody: document.querySelector("#sampleFileListTable tbody"),
  sampleStatus: document.getElementById("sampleStatus"),
  sampleParsedHead: document.querySelector("#sampleParsedTable thead"),
  sampleParsedBody: document.querySelector("#sampleParsedTable tbody"),
  sampleOutputHead: document.querySelector("#sampleOutputTable thead"),
  sampleOutputBody: document.querySelector("#sampleOutputTable tbody"),
  downloadSampleExcelBtn: document.getElementById("downloadSampleExcelBtn"),
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

function renderFileSelection(metaEl, tableHead, tableBody, files, options = {}) {
  const { emptyText = "No files selected.", prefix = "Selected invoices" } = options;
  if (!files.length) {
    metaEl.textContent = emptyText;
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    return;
  }
  const totalBytes = files.reduce((acc, f) => acc + Number(f.size || 0), 0);
  metaEl.textContent = `${prefix}: ${files.length} file(s), ${Math.round(totalBytes / 1024)} KB total`;
  const rows = files.map((f, idx) => ({
    "#": idx + 1,
    name: f.name,
    size_kb: (Number(f.size || 0) / 1024).toFixed(1),
    type: f.type || "application/pdf",
  }));
  renderTable(tableHead, tableBody, rows);
}

function renderSelectedFiles() {
  renderFileSelection(el.fileListMeta, el.fileListHead, el.fileListBody, selectedFiles, {
    emptyText: "No files selected.",
    prefix: "Selected invoices",
  });
}

function renderSampleRun() {
  renderFileSelection(
    el.sampleFileListMeta,
    el.sampleFileListHead,
    el.sampleFileListBody,
    SAMPLE_RUN.selectedFiles,
    {
      emptyText: "No sample files loaded.",
      prefix: "Sample invoice",
    }
  );
  renderTable(el.sampleParsedHead, el.sampleParsedBody, SAMPLE_RUN.parsedInvoices);
  renderTable(el.sampleOutputHead, el.sampleOutputBody, SAMPLE_RUN.journalRows);
  el.sampleStatus.textContent = SAMPLE_RUN.statusText;
}

function formatProcessError(status, errText) {
  let detail = errText;
  try {
    const parsed = JSON.parse(errText);
    detail = parsed.detail || parsed.message || errText;
  } catch {
    detail = errText;
  }
  if (String(detail).includes("Missing GEMINI_API_KEY")) {
    return "Live Gemini processing is disabled in this demo.\nExpand Sample run below to review a completed invoice flow.";
  }
  return `Process failed (${status}): ${detail}`;
}

function applyDemoModeState() {
  el.runBtn.disabled = true;
  el.runBtn.title = "Live processing is disabled in this demo.";
  if (el.liveProcessingBadge) {
    el.liveProcessingBadge.textContent = "Live processing disabled";
  }
  setStatus("Demo mode.");
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

async function downloadWorkbookFromAsset(assetPath, filename) {
  const res = await fetch(assetPath);
  if (!res.ok) {
    throw new Error(`Sample workbook load failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "sample_output.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
    throw new Error(formatProcessError(res.status, errText));
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

el.downloadSampleExcelBtn.addEventListener("click", async () => {
  try {
    await downloadWorkbookFromAsset(SAMPLE_RUN.workbookAssetPath, SAMPLE_RUN.workbookFilename);
  } catch (err) {
    console.error(err);
    buildWorkbookInBrowser(
      SAMPLE_RUN.journalRows,
      SAMPLE_RUN.outputColumns,
      SAMPLE_RUN.workbookFilename
    );
  }
});

async function boot() {
  try {
    renderSampleRun();
    renderSelectedFiles();
    await loadMappings();
    applyDemoModeState();
  } catch (err) {
    console.error(err);
    setStatus(`Startup error: ${err.message}`);
  }
}

boot();
