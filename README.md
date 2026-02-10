# AR Invoice Demo (Public Repo Version)

## What this demo does
This is a simple web demo for invoice ingestion.

You can:
1. Upload multiple invoice PDFs at once (or add more in several steps).
2. Extract structured invoice data with Gemini.
3. Match client names against a small mapping table.
4. Generate accounting-ready rows.
5. Download an Excel output.

## What is inside
- A web page (`index.html`) that anyone can use.
- A lightweight API (`/api/*`) for Cloudflare Pages Functions.
- A sample mapping set with 5 clients.
- Rules for unknown clients:
  - `upload = no`
  - note includes `CLIENT NOT IN MAPPING`
  - mapping-dependent fields fallback to `UNKNOWN`

## Safe for a public repository
- Secrets are **not** in code.
- `.env` is ignored by `.gitignore`.
- Gemini key is read from Cloudflare environment variables (server side), not exposed to browser users.

## Deploy on Cloudflare Pages
1. Create a new Cloudflare Pages project from this repo.
2. Set environment variables in Cloudflare:
   - `GEMINI_API_KEY` (required)
   - `GEMINI_MODEL` (optional, default works)
3. Deploy.
4. Keep `GEMINI_API_KEY` only in Cloudflare environment variables (or local `.env` for local-only testing). Do not commit `.env`.

No backend server setup is needed: API routes run as Cloudflare Pages Functions.

## Local run (optional)
If you want to test locally with Python backend:
1. Copy `.env.example` to `.env`
2. Add your key
3. Run `.\run_demo.ps1`

## Notes
- In Cloudflare mode, the API returns JSON rows and the browser creates the Excel download.
- In local Python mode, template-based Excel generation is available.
