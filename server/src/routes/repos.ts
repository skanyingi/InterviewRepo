import { Router } from 'express';
import { getSessionGithubToken, requireAuth } from '../auth/session.js';
import { asyncHandler } from '../http.js';
import { listPublicRepos } from '../services/github.js';

export const reposRouter = Router();

reposRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = await getSessionGithubToken(req.sessionToken!);
    if (!token) {
      res.status(401).json({ error: 'Sign in with GitHub again to allow repository access' });
      return;
    }

    try {
      const repos = await listPublicRepos(token);
      res.json(repos);
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  }),
);
