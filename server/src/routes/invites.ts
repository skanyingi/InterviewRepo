import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { assessments, invites, smsLogs, users } from '../db/schema.js';
import { requireRole } from '../auth/session.js';
import { asyncHandler } from '../http.js';
import { config } from '../config.js';

export const invitesRouter = Router();

function inviteLink(token: string): string {
  return `${config.webOrigin.replace(/\/$/, '')}/invite/${token}`;
}

invitesRouter.post(
  '/',
  requireRole('recruiter', 'admin'),
  asyncHandler(async (req, res) => {
    const raw = typeof req.body?.focusArea === 'string' ? req.body.focusArea.trim() : '';
    if (raw.length < 2 || raw.length > 200) {
      res.status(400).json({ error: 'Focus area must be between 2 and 200 characters' });
      return;
    }

    const token = randomBytes(16).toString('base64url');
    const [invite] = await db
      .insert(invites)
      .values({ token, recruiterId: req.user!.id, focusArea: raw })
      .returning();

    res.status(201).json({ ...invite, link: inviteLink(invite.token) });
  }),
);

invitesRouter.get(
  '/',
  requireRole('recruiter', 'admin'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const rows = await db
      .select({
        id: invites.id,
        token: invites.token,
        focusArea: invites.focusArea,
        status: invites.status,
        createdAt: invites.createdAt,
        recruiterUsername: users.username,
      })
      .from(invites)
      .innerJoin(users, eq(invites.recruiterId, users.id))
      .where(user.role === 'admin' ? undefined : eq(invites.recruiterId, user.id))
      .orderBy(desc(invites.createdAt));

    const inviteIds = rows.map((row) => row.id);

    const assessmentRows =
      inviteIds.length > 0
        ? await db
            .select({
              id: assessments.id,
              inviteId: assessments.inviteId,
              status: assessments.status,
              totalScore: assessments.totalScore,
              applicantUsername: users.username,
            })
            .from(assessments)
            .innerJoin(users, eq(assessments.applicantId, users.id))
            .where(inArray(assessments.inviteId, inviteIds))
        : [];

    const assessmentIds = assessmentRows.map((row) => row.id);

    const latestSmsStatus = new Map<string, string>();
    if (assessmentIds.length > 0) {
      const smsRows = await db
        .select({ assessmentId: smsLogs.assessmentId, status: smsLogs.status })
        .from(smsLogs)
        .where(inArray(smsLogs.assessmentId, assessmentIds))
        .orderBy(desc(smsLogs.createdAt));
      for (const sms of smsRows) {
        if (!latestSmsStatus.has(sms.assessmentId)) {
          latestSmsStatus.set(sms.assessmentId, sms.status);
        }
      }
    }

    const assessmentByInvite = new Map(
      assessmentRows.map((row) => [
        row.inviteId,
        {
          id: row.id,
          status: row.status,
          totalScore: row.totalScore,
          applicantUsername: row.applicantUsername,
          smsStatus: latestSmsStatus.get(row.id) ?? null,
        },
      ]),
    );

    res.json(
      rows.map((row) => ({
        ...row,
        link: inviteLink(row.token),
        assessment: assessmentByInvite.get(row.id) ?? null,
      })),
    );
  }),
);

invitesRouter.get(
  '/token/:token',
  asyncHandler(async (req, res) => {
    const token = String(req.params.token);
    const rows = await db
      .select({
        focusArea: invites.focusArea,
        status: invites.status,
        recruiterUsername: users.username,
      })
      .from(invites)
      .innerJoin(users, eq(invites.recruiterId, users.id))
      .where(eq(invites.token, token))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    res.json(rows[0]);
  }),
);
