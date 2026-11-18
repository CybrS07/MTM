# Mind to Machine planner

React + Vite + TypeScript, running entirely in the browser · Gemini called directly with the user's own token · Supabase for login, receipts and the assistant.

## Setup
1. `npm install`
2. (Optional login) Supabase → SQL Editor → paste and run `sql/schema.sql`, and set the `VITE_SUPABASE_*` values in `.env`
3. `npm run dev` → open https://localhost:5173 (accept the local certificate warning once)
4. In **Message input**, paste your free Gemini token (https://aistudio.google.com/apikey) and press **Plan the event**

## Where the model is used
Only `src/planner/ai.ts` calls a model (area "reading"). Venue, schedule, food, judging and budget are plain code in `src/planner/plan.ts`; `src/planner/checks.ts` validates the six checks. A message is rejected if the model says it is wrong or if applying it breaks any check.

## Security
- There is no server. The plan is kept in this browser (localStorage).
- The Gemini token is typed by the user, kept in this browser and sent only to `generativelanguage.googleapis.com` (allowed by the page's Content-Security-Policy).
- `.env` is git-ignored; never put a secret key in a `VITE_` variable.
