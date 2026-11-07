import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { loadSession, requireAuth } from './auth/session.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { invitesRouter } from './routes/invites.js';
import { reposRouter } from './routes/repos.js';
import { assessmentsRouter } from './routes/assessments.js';
import { smsRouter } from './routes/sms.js';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(loadSession);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = req.user!;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/repos', reposRouter);
app.use('/api/assessments', assessmentsRouter);
app.use('/api/sms', smsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`RepoInterview server listening on http://localhost:${config.port}`);
});
