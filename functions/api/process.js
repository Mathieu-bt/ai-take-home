import {
  buildDescription,
  ddmmyyyyToYyyymmdd,
  findBestClient,
  glMappings,
  outputColumns,
  periodFromServiceLabel,
  periodFromYyyymmdd,
} from "../_shared/mappings.js";

const invoiceJsonSchema = {
  type: "OBJECT",
  required: [
    "invoice_number",
    "invoice_date",
    "due_date",
    "currency",
    "customer_name",
    "service_type",
    "service_description",
    "service_period_label",
    "net_amount",
    "tax_label",
    "tax_amount",
    "total_amount",
    "is_tax_invoice",
    "confidence",
  ],
  properties: {
    invoice_number: { type: "STRING" },
    invoice_date: { type: "STRING" },
    due_date: { type: "STRING" },
    currency: { type: "STRING" },
    customer_name: { type: "STRING" },
    service_type: { type: "STRING" },
    service_description: { type: "STRING" },
    service_period_label: { type: "STRING" },
    net_amount: { type: "NUMBER" },
    tax_label: { type: "STRING" },
    tax_amount: { type: "NUMBER" },
    total_amount: { type: "NUMBER" },
    is_tax_invoice: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
  },
};

const prompt = `
You are extracting structured accounting data from a customer invoice PDF.
OCR the full document and return ONLY valid JSON that matches the schema.

Rules:
- Date format must be DD/MM/YYYY.
- Amount fields must be numeric (not strings).
- customer_name = the billed customer receiving the invoice.
- service_period_label should look like "January 2026", "February 2026", etc.
- If no tax is present, set tax_amount to 0 and tax_label to "No tax".
- confidence is between 0 and 1.
`;

function bytesToBase64(uint8) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < uint8.length; i += chunk) {
    const slice = uint8.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function cleanJsonText(text) {
  return text
    .trim()
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

async function extractWithGemini(file, env) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in Cloudflare environment variables.");
  }
  const model = env.GEMINI_MODEL || "gemini-2.0-flash";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64Pdf = bytesToBase64(bytes);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: base64Pdf,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: invoiceJsonSchema,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Gemini API error for ${file.name}: ${resp.status} ${errText.slice(0, 400)}`);
    throw new Error(`Gemini API error for ${file.name}: ${resp.status}`);
  }

  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = JSON.parse(cleanJsonText(text));
  parsed.source_file = file.name;
  return parsed;
}

function buildRows(extracted, voucherNo) {
  const clientMatch = findBestClient(extracted.customer_name || "");
  const notes = [];
  let uploadFlag = "yes";
  let clientIdLookup;
  let clientName;
  let supplierCustomerName;
  let dimensionId;
  let dimensionName;

  if (!clientMatch) {
    uploadFlag = "no";
    notes.push("CLIENT NOT IN MAPPING");
    clientIdLookup = "UNKNOWN";
    clientName = "UNKNOWN";
    supplierCustomerName = "UNKNOWN";
    dimensionId = "UNKNOWN";
    dimensionName = "UNKNOWN";
  } else {
    clientIdLookup = clientMatch.client_code;
    clientName = clientMatch.canonical_name || "UNKNOWN";
    supplierCustomerName = clientMatch.supplier_customer_name || "UNKNOWN";
    dimensionId = clientMatch.default_dimension_id || "UNKNOWN";
    dimensionName = clientMatch.default_dimension_name || "UNKNOWN";
  }

  const invoiceDateFmt = ddmmyyyyToYyyymmdd(extracted.invoice_date || "");
  const period = periodFromServiceLabel(extracted.service_period_label || "") || periodFromYyyymmdd(invoiceDateFmt);
  if (!period) {
    notes.push("Missing service period label; period fallback failed.");
  }

  const totalAmount = Number(extracted.total_amount || 0);
  const netAmount = Number(extracted.net_amount || 0);
  const taxAmount = Number(extracted.tax_amount || 0);
  const invoiceNumber = extracted.invoice_number || "";
  const currency = String(extracted.currency || "").toUpperCase();
  const noteText = notes.join("; ");

  const rows = [
    {
      upload: uploadFlag,
      voucher_no: voucherNo,
      "GL lookup": glMappings.AR.gl_lookup,
      trans_type: glMappings.AR.trans_type,
      "GL account name": glMappings.AR.gl_account_name,
      Client_id_lookup: clientIdLookup,
      Client_name: clientName,
      period,
      Dimension_id_lookup: uploadFlag === "no" ? "UNKNOWN" : "",
      Dimension_name: uploadFlag === "no" ? "UNKNOWN" : "",
      "Suppl/cust_name": supplierCustomerName,
      inv_ref: invoiceNumber,
      invoice_date: invoiceDateFmt,
      currency,
      cur_amount: Number(totalAmount.toFixed(2)),
      description: buildDescription(clientName, "AR", period),
      notes: noteText,
    },
    {
      upload: uploadFlag,
      voucher_no: voucherNo,
      "GL lookup": glMappings.SERVICE.gl_lookup,
      trans_type: glMappings.SERVICE.trans_type,
      "GL account name": glMappings.SERVICE.gl_account_name,
      Client_id_lookup: clientIdLookup,
      Client_name: clientName,
      period,
      Dimension_id_lookup: dimensionId,
      Dimension_name: dimensionName,
      "Suppl/cust_name": supplierCustomerName,
      inv_ref: invoiceNumber,
      invoice_date: invoiceDateFmt,
      currency,
      cur_amount: Number((-netAmount).toFixed(2)),
      description: buildDescription(clientName, dimensionName || "Service", period),
      notes: noteText,
    },
  ];

  if (Math.abs(taxAmount) > 0.0001) {
    rows.push({
      upload: uploadFlag,
      voucher_no: voucherNo,
      "GL lookup": glMappings.TAX.gl_lookup,
      trans_type: glMappings.TAX.trans_type,
      "GL account name": glMappings.TAX.gl_account_name,
      Client_id_lookup: clientIdLookup,
      Client_name: clientName,
      period,
      Dimension_id_lookup: uploadFlag === "no" ? "UNKNOWN" : "",
      Dimension_name: uploadFlag === "no" ? "UNKNOWN" : "",
      "Suppl/cust_name": supplierCustomerName,
      inv_ref: invoiceNumber,
      invoice_date: invoiceDateFmt,
      currency,
      cur_amount: Number((-taxAmount).toFixed(2)),
      description: buildDescription(clientName, "Tax", period),
      notes: noteText,
    });
  }
  return rows;
}

export async function onRequestPost(context) {
  try {
    const contentType = context.request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ detail: "Expected multipart/form-data with files field." }, { status: 400 });
    }

    const form = await context.request.formData();
    const files = form.getAll("files");
    if (!files.length) {
      return Response.json({ detail: "No files uploaded." }, { status: 400 });
    }

    const parsedInvoices = [];
    const journalRows = [];

    let voucherNo = 0;
    for (const entry of files) {
      if (!(entry instanceof File)) continue;
      const extracted = await extractWithGemini(entry, context.env);
      parsedInvoices.push(extracted);
      journalRows.push(...buildRows(extracted, voucherNo));
      voucherNo += 1;
    }

    return Response.json({
      parsed_invoices: parsedInvoices,
      journal_rows: journalRows,
      output_columns: outputColumns,
      workbook_base64: null,
      workbook_filename: null,
      note: "Cloudflare mode returns JSON rows. Excel is generated in browser download.",
    });
  } catch (err) {
    return Response.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
