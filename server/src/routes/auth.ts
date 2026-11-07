import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { config, isGithubConfigured } from '../config.js';
import { asyncHandler } from '../http.js';
import {
  OAUTH_STATE_COOKIE,
  buildAuthorizeUrl,
  createOAuthState,
  exchangeCodeForToken,
  fetchGithubUser,
} from '../auth/github.js';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  setSessionCookie,
} from '../auth/session.js';

export const authRouter = Router();

authRouter.get('/github', (req, res) => {
  if (!isGithubConfigured()) {
    res.status(500).json({
      error:
        'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in server/.env',
    });
    return;
  }

  const state = createOAuthState();
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
  res.redirect(buildAuthorizeUrl(state));
});

authRouter.get(
  '/github/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const expectedState: string | undefined = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

    if (!code || !state || !expectedState || state !== expectedState) {
      res.status(400).json({ error: 'Invalid OAuth callback' });
      return;
    }

    let accessToken: string;
    let githubUser;
    try {
      accessToken = await exchangeCodeForToken(code);
      githubUser = await fetchGithubUser(accessToken);
    } catch (error) {
      console.error('GitHub sign-in failed:', error);
      res.status(502).json({ error: 'GitHub sign-in failed' });
      return;
    }

    const existingRows = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubUser.id))
      .limit(1);
    let user = existingRows[0];

    if (user) {
      const updatedRows = await db
        .update(users)
        .set({
          username: githubUser.login,
          displayName: githubUser.name,
          avatarUrl: githubUser.avatar_url,
        })
        .where(eq(users.id, user.id))
        .returning();
      user = updatedRows[0];
    } else {
      const anyUserRows = await db.select({ id: users.id }).from(users).limit(1);
      const role = anyUserRows.length === 0 ? 'admin' : 'applicant';
      const insertedRows = await db
        .insert(users)
        .values({
          githubId: githubUser.id,
          username: githubUser.login,
          displayName: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          role,
        })
        .returning();
      user = insertedRows[0];
    }

    const session = await createSession(user.id, accessToken);
    setSessionCookie(res, session.token, session.expiresAt);
    res.redirect(config.webOrigin);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.sessionToken) {
      await destroySession(req.sessionToken);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  }),
);
