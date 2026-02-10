import { clients, glMappings } from "../_shared/mappings.js";

export async function onRequestGet() {
  return Response.json({
    clients: clients.map((c) => ({
      client_code: c.client_code,
      canonical_name: c.canonical_name,
      client_lookup: c.client_lookup,
      supplier_customer_name: c.supplier_customer_name,
    })),
    gl_mappings: Object.values(glMappings),
    service_mappings: [
      { service_keyword: "finance operations support", service_label: "SMB Finance Ops", gl_mapping_key: "SERVICE" },
      { service_keyword: "receivables analytics", service_label: "Receivables Analytics", gl_mapping_key: "SERVICE" },
      { service_keyword: "smb finance process automation", service_label: "SMB Process Automation", gl_mapping_key: "SERVICE" },
      { service_keyword: "receivables reporting", service_label: "Receivables Reporting", gl_mapping_key: "SERVICE" },
    ],
  });
}
