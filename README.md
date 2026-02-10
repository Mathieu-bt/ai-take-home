# AR Invoice Ingestion Demo

Small MVP for invoice ingestion and accounting row generation.

## Features
1. Upload one or many invoice PDFs.
2. Extract invoice fields with Gemini.
3. Match customer names against predefined client mappings.
4. Generate AR journal-style output rows.
5. Export results to Excel.

## Project structure
- `index.html`, `app.js`, `styles.css`: frontend UI and table rendering.
- `functions/api/*`: Cloudflare Functions API endpoints.
- `functions/_shared/mappings.js`: client + GL mappings and shared helpers.
- `server.py`: local FastAPI backend variant.
- `db.py`, `init_db.py`: local SQLite setup and lookup logic.
- `Heron Data - AR ingestion layout.xlsx`: Excel layout template.

## Local run
1. Create and activate a Python virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and set values.
4. Start the app:
   ```powershell
   .\run_demo.ps1
   ```

## API endpoints
- `GET /api/health`
- `GET /api/mappings`
- `POST /api/process` (multipart form with `files`)
