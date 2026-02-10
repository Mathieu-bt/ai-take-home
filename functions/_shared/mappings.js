export const outputColumns = [
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
];

export const clients = [
  {
    client_code: "CL001",
    canonical_name: "ClearRock Lending Solutions Inc.",
    aliases: [
      "ClearRock Lending Solutions Inc.",
      "ClearRock Lending Solutions",
      "ClearRock",
    ],
    client_lookup: "Heron Data Ltd",
    supplier_customer_name: "ClearRock Lending Solutions Inc.",
    default_dimension_id: "P90001387",
    default_dimension_name: "A. Morgan",
  },
  {
    client_code: "CL002",
    canonical_name: "Meridian Trade Finance Pte. Ltd.",
    aliases: [
      "Meridian Trade Finance Pte. Ltd.",
      "Meridian Trade Finance",
      "Meridian",
    ],
    client_lookup: "Heron Data Ltd",
    supplier_customer_name: "Meridian Trade Finance Pte. Ltd.",
    default_dimension_id: "P90001415",
    default_dimension_name: "J. Lee",
  },
  {
    client_code: "CL003",
    canonical_name: "Fayat Energies Services",
    aliases: ["Fayat Energies Services", "Fayat Energies"],
    client_lookup: "Heron Data Ltd",
    supplier_customer_name: "Fayat Energies Services",
    default_dimension_id: "P90001004",
    default_dimension_name: "K. Durant",
  },
  {
    client_code: "CL004",
    canonical_name: "Northbridge Asset Finance Ltd",
    aliases: ["Northbridge Asset Finance Ltd", "Northbridge Asset Finance"],
    client_lookup: "Heron Data Ltd",
    supplier_customer_name: "Northbridge Asset Finance Ltd",
    default_dimension_id: "P90001208",
    default_dimension_name: "R. White",
  },
  {
    client_code: "CL005",
    canonical_name: "Atlas Equipment Finance LLC",
    aliases: ["Atlas Equipment Finance LLC", "Atlas Equipment Finance", "Atlas"],
    client_lookup: "Heron Data Ltd",
    supplier_customer_name: "Atlas Equipment Finance LLC",
    default_dimension_id: "P90001555",
    default_dimension_name: "M. Patel",
  },
];

export const glMappings = {
  AR: { mapping_key: "AR", gl_lookup: "12000", gl_account_name: "Accounts Receivable", trans_type: "AR" },
  SERVICE: { mapping_key: "SERVICE", gl_lookup: "80004", gl_account_name: "Services performed", trans_type: "GL" },
  TAX: { mapping_key: "TAX", gl_lookup: "20045", gl_account_name: "VAT/WHT", trans_type: "GL" },
};

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findBestClient(customerName) {
  const target = normalize(customerName);
  if (!target) return null;

  let best = null;
  let bestScore = 0;
  for (const c of clients) {
    for (const alias of c.aliases) {
      const nAlias = normalize(alias);
      if (nAlias === target) return c;
      const a = new Set(nAlias.split(" "));
      const b = new Set(target.split(" "));
      if (!a.size || !b.size) continue;
      let inter = 0;
      for (const tok of a) {
        if (b.has(tok)) inter += 1;
      }
      const union = new Set([...a, ...b]).size;
      const score = union ? inter / union : 0;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }
  return bestScore >= 0.35 ? best : null;
}

export function periodFromServiceLabel(servicePeriodLabel) {
  const value = (servicePeriodLabel || "").toLowerCase().trim();
  if (!value) return "";
  const months = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const yearMatch = value.match(/(20\d{2})/);
  if (!yearMatch) return "";
  const year = yearMatch[1];
  let month = "";
  for (const [name, mm] of Object.entries(months)) {
    if (value.includes(name)) {
      month = mm;
      break;
    }
  }
  return month ? `${year}${month}` : "";
}

export function ddmmyyyyToYyyymmdd(d) {
  const m = (d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}${m[2]}${m[1]}`;
}

export function periodFromYyyymmdd(d) {
  return d && d.length >= 6 ? d.slice(0, 6) : "";
}

export function buildDescription(clientName, dimensionName, period) {
  return [clientName, dimensionName, period].filter(Boolean).join(" ").trim();
}
