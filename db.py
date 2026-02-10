import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional


def get_db_path() -> str:
  return os.getenv("SQLITE_DB_PATH", "./demo_mappings.db")


def connect_db() -> sqlite3.Connection:
  db_path = Path(get_db_path())
  db_path.parent.mkdir(parents=True, exist_ok=True)
  conn = sqlite3.connect(str(db_path))
  conn.row_factory = sqlite3.Row
  return conn


def init_db() -> None:
  conn = connect_db()
  cur = conn.cursor()

  cur.executescript(
    """
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT UNIQUE NOT NULL,
      canonical_name TEXT NOT NULL,
      aliases_json TEXT NOT NULL,
      client_lookup TEXT NOT NULL,
      supplier_customer_name TEXT NOT NULL,
      default_dimension_id TEXT,
      default_dimension_name TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS gl_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mapping_key TEXT UNIQUE NOT NULL,
      gl_lookup TEXT NOT NULL,
      gl_account_name TEXT NOT NULL,
      trans_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_keyword TEXT UNIQUE NOT NULL,
      service_label TEXT NOT NULL,
      gl_mapping_key TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS output_defaults (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    """
  )

  # Seed 5 clients (2 from provided generated invoices + 3 additional)
  clients_seed = [
    (
      "CL001",
      "ClearRock Lending Solutions Inc.",
      json.dumps(
        [
          "ClearRock Lending Solutions Inc.",
          "ClearRock Lending Solutions",
          "ClearRock",
        ]
      ),
      "Heron Data Ltd",
      "ClearRock Lending Solutions Inc.",
      "P90001387",
      "A. Morgan",
    ),
    (
      "CL002",
      "Meridian Trade Finance Pte. Ltd.",
      json.dumps(
        [
          "Meridian Trade Finance Pte. Ltd.",
          "Meridian Trade Finance",
          "Meridian",
        ]
      ),
      "Heron Data Ltd",
      "Meridian Trade Finance Pte. Ltd.",
      "P90001415",
      "J. Lee",
    ),
    (
      "CL003",
      "Fayat Energies Services",
      json.dumps(["Fayat Energies Services", "Fayat Energies"]),
      "Heron Data Ltd",
      "Fayat Energies Services",
      "P90001004",
      "K. Durant",
    ),
    (
      "CL004",
      "Northbridge Asset Finance Ltd",
      json.dumps(["Northbridge Asset Finance Ltd", "Northbridge Asset Finance"]),
      "Heron Data Ltd",
      "Northbridge Asset Finance Ltd",
      "P90001208",
      "R. White",
    ),
    (
      "CL005",
      "Atlas Equipment Finance LLC",
      json.dumps(["Atlas Equipment Finance LLC", "Atlas Equipment Finance", "Atlas"]),
      "Heron Data Ltd",
      "Atlas Equipment Finance LLC",
      "P90001555",
      "M. Patel",
    ),
  ]
  cur.executemany(
    """
    INSERT INTO clients
      (client_code, canonical_name, aliases_json, client_lookup, supplier_customer_name, default_dimension_id, default_dimension_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_code) DO UPDATE SET
      canonical_name = excluded.canonical_name,
      aliases_json = excluded.aliases_json,
      client_lookup = excluded.client_lookup,
      supplier_customer_name = excluded.supplier_customer_name,
      default_dimension_id = excluded.default_dimension_id,
      default_dimension_name = excluded.default_dimension_name,
      active = 1
    """,
    clients_seed,
  )

  gl_seed = [
    ("AR", "12000", "Accounts Receivable", "AR"),
    ("SERVICE", "80004", "Services performed", "GL"),
    ("TAX", "20045", "VAT/WHT", "GL"),
  ]
  cur.executemany(
    """
    INSERT INTO gl_mappings (mapping_key, gl_lookup, gl_account_name, trans_type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(mapping_key) DO UPDATE SET
      gl_lookup = excluded.gl_lookup,
      gl_account_name = excluded.gl_account_name,
      trans_type = excluded.trans_type
    """,
    gl_seed,
  )

  service_seed = [
    ("finance operations support", "SMB Finance Ops", "SERVICE"),
    ("receivables analytics", "Receivables Analytics", "SERVICE"),
    ("smb finance process automation", "SMB Process Automation", "SERVICE"),
    ("receivables reporting", "Receivables Reporting", "SERVICE"),
  ]
  cur.executemany(
    """
    INSERT OR IGNORE INTO service_mappings (service_keyword, service_label, gl_mapping_key)
    VALUES (?, ?, ?)
    """,
    service_seed,
  )

  defaults_seed = [
    ("client_id", "400"),
    ("tax_row_threshold", "0.0001"),
  ]
  cur.executemany(
    """
    INSERT OR IGNORE INTO output_defaults (key, value)
    VALUES (?, ?)
    """,
    defaults_seed,
  )

  conn.commit()
  conn.close()


def _normalize(name: str) -> str:
  cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in (name or ""))
  return " ".join(cleaned.split())


def find_best_client(customer_name: str) -> Optional[Dict[str, Any]]:
  conn = connect_db()
  rows = conn.execute("SELECT * FROM clients WHERE active = 1").fetchall()
  conn.close()

  target = _normalize(customer_name)
  best_row = None
  best_score = 0.0

  for row in rows:
    aliases = json.loads(row["aliases_json"])
    for alias in aliases:
      norm_alias = _normalize(alias)
      if norm_alias == target and target:
        return dict(row)
      alias_tokens = set(norm_alias.split())
      target_tokens = set(target.split())
      if not alias_tokens or not target_tokens:
        continue
      overlap = len(alias_tokens & target_tokens) / len(alias_tokens | target_tokens)
      if overlap > best_score:
        best_score = overlap
        best_row = row

  if best_row is not None and best_score >= 0.35:
    return dict(best_row)
  return None


def get_gl_mapping(mapping_key: str) -> Dict[str, Any]:
  conn = connect_db()
  row = conn.execute(
    "SELECT mapping_key, gl_lookup, gl_account_name, trans_type FROM gl_mappings WHERE mapping_key = ?",
    (mapping_key,),
  ).fetchone()
  conn.close()
  if row is None:
    raise RuntimeError(f"Missing GL mapping for key={mapping_key}")
  return dict(row)


def get_output_default(key: str, fallback: str = "") -> str:
  conn = connect_db()
  row = conn.execute("SELECT value FROM output_defaults WHERE key = ?", (key,)).fetchone()
  conn.close()
  return row["value"] if row else fallback


def list_seed_data() -> Dict[str, List[Dict[str, Any]]]:
  conn = connect_db()
  clients = [dict(r) for r in conn.execute("SELECT client_code, canonical_name, client_lookup, supplier_customer_name FROM clients ORDER BY client_code").fetchall()]
  gl = [dict(r) for r in conn.execute("SELECT mapping_key, gl_lookup, gl_account_name, trans_type FROM gl_mappings ORDER BY id").fetchall()]
  service = [dict(r) for r in conn.execute("SELECT service_keyword, service_label, gl_mapping_key FROM service_mappings ORDER BY id").fetchall()]
  conn.close()
  return {"clients": clients, "gl_mappings": gl, "service_mappings": service}
