# Mind to Machine planner

React + Vite + TypeScript frontend · TypeScript (Express) API over HTTPS · Python reader calling Gemini · Supabase storage.

## Setup
1. `npm install`
2. Supabase → SQL Editor → paste and run `sql/schema.sql`
3. Python 3.9+ must be on PATH (no pip packages needed)
4. `npm run dev` → open https://localhost:5173 (accept the local certificate warning once)

## One command (terminal)
- `npm run plan` reads `data/messages.txt` and prints the trace
- `npm run update` reads `data/update.txt` and updates the plan

## Where the model is used
Only `ai/reader.py` calls a model (area "reading"). Venue, schedule, food, judging and budget are plain code in `api/src/plan.ts`; `api/src/checks.ts` validates the six checks. A message is rejected if the model says it is wrong or if applying it breaks any check.

## Security
- API is HTTPS only (TLS 1.2+, HSTS). Port 8080 only redirects to HTTPS.
- Gemini and Supabase secret keys stay on the server. The browser never sees them.
- `.env` is git-ignored.
