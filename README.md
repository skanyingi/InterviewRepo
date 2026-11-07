# RepoInterview

Code-grounded technical interviews: an applicant connects a public GitHub repo, Gemini writes questions about a chosen focus area of that code, answers are scored automatically, and the score is delivered by SMS via ThriveVAS.

## Features

- **GitHub OAuth sign-in** with server-side session cookies and roles (`applicant`, `recruiter`, `admin`); the first user to sign in becomes `admin`
- **Recruiter invites** — pick a focus area (e.g. `authentication`), share a link
- **Repo reading** — pulls relevant public-repo files through the GitHub API (consent required)
- **Question generation** — Google Gemini writes 5–8 questions about the focus area
- **Answering & scoring** — answers typed in the browser; Gemini grades each 0–10 with feedback, rolled up into a total percentage
- **SMS results** — ThriveVAS sends the total score (consent + Kenyan phone validation), with delivery-report tracking
- **Admin panel** — manage user roles, view all assessments and SMS statuses

Permissions are enforced on the backend (`requireAuth` / `requireRole`), not just hidden in the UI.

## Tech

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: SQLite via Drizzle ORM (`@libsql/client`)
- Auth: GitHub OAuth with session cookies
- LLM: Google Gemini (`@google/genai`)
- SMS: ThriveVAS (`POST https://sms.thrivevas.com/v1/message/send`)

## Project structure

```
server/          Express app, Drizzle schema, migrations, services (github, gemini, sms)
web/             React + Vite frontend (single-page app, no router dependency)
drizzle/         Generated SQL migrations (server/drizzle)
```

## Setup

Requires Node 22+.

```bash
npm install
npm run db:migrate
```

Copy `server/.env.example` to `server/.env` and fill in:

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app (callback: `http://localhost:3000/api/auth/github/callback`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google AI Studio key (default model `gemini-2.5-flash`) |
| `THRIVEVAS_API_KEY`, `THRIVEVAS_SENDER_ID` | ThriveVAS credentials (sender ID must be registered on the account) |
| `THRIVEVAS_CALLBACK_URL` | Delivery-report webhook (needs a public URL in production) |

Never commit `.env` — it is gitignored.

## Run

```bash
npm run dev:server   # http://localhost:3000
npm run dev:web      # http://localhost:5173
```

Open http://localhost:5173.

## Flow

1. Sign in with GitHub (first user becomes admin).
2. As recruiter/admin, create an invite with a focus area and copy the link.
3. Applicant opens the link, picks a public repo, consents, and starts the assessment.
4. Questions are generated; the applicant submits answers.
5. Answers are scored (0–10 each, total percentage).
6. Applicant enters a Kenyan phone number, consents, and receives the score by SMS.

## Deploy (single service)

The Express server serves the built frontend (`web/dist`), so frontend and API share one origin — no CORS and cookies just work.

- Build command: `npm install && npm run build`
- Start command: `npm start` (runs DB migrations, then the server)
- Set env vars in your host's dashboard (never commit `.env`):
  `NODE_ENV=production`, `PORT`, `WEB_ORIGIN=https://your-domain`,
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
  `GITHUB_CALLBACK_URL=https://your-domain/api/auth/github/callback`,
  `GEMINI_API_KEY`, `GEMINI_MODEL`,
  `THRIVEVAS_API_KEY`, `THRIVEVAS_SENDER_ID`,
  `THRIVEVAS_CALLBACK_URL=https://your-domain/api/sms/dlr`
- Update the GitHub OAuth app callback to the deployed URL above.
- `WEB_ORIGIN` must be the deployed URL (it is where users land after OAuth).
- **SQLite persistence:** most hosts reset the filesystem on deploy. Mount a persistent disk and set `DB_FILE=/data/repointerview.db`; otherwise data resets on each deploy.
- The ThriveVAS delivery callback also needs this public URL to receive delivery reports.

## Scripts

```bash
npm run typecheck    # typecheck server + web
npm run db:generate  # generate a migration from schema changes
npm run db:migrate   # apply pending migrations
npm run build -w web # production build of the frontend
```
