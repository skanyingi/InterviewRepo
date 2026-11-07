import { Router } from 'express';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { assessments, smsLogs, users } from '../db/schema.js';
import { requireRole } from '../auth/session.js';
import { asyncHandler } from '../http.js';

export const adminRouter = Router();

const ROLES = ['applicant', 'recruiter', 'admin'] as const;
type Role = (typeof ROLES)[number];

adminRouter.get(
  '/users',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users);
    res.json(rows);
  }),
);

adminRouter.patch(
  '/users/:id/role',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const role = req.body?.role;

    if (!ROLES.includes(role as Role)) {
      res.status(400).json({ error: 'role must be applicant, recruiter or admin' });
      return;
    }

    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ role: role as Role })
      .where(eq(users.id, id))
      .returning();

    res.json({ id: updated.id, username: updated.username, role: updated.role });
  }),
);

adminRouter.get(
  '/assessments',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: assessments.id,
        focusArea: assessments.focusArea,
        repoFullName: assessments.repoFullName,
        status: assessments.status,
        totalScore: assessments.totalScore,
        createdAt: assessments.createdAt,
        applicantUsername: users.username,
      })
      .from(assessments)
      .innerJoin(users, eq(assessments.applicantId, users.id))
      .orderBy(desc(assessments.createdAt));

    const ids = rows.map((row) => row.id);
    const latestSmsStatus = new Map<string, string>();

    if (ids.length > 0) {
      const smsRows = await db
        .select({ assessmentId: smsLogs.assessmentId, status: smsLogs.status })
        .from(smsLogs)
        .where(inArray(smsLogs.assessmentId, ids))
        .orderBy(desc(smsLogs.createdAt));
      for (const sms of smsRows) {
        if (!latestSmsStatus.has(sms.assessmentId)) {
          latestSmsStatus.set(sms.assessmentId, sms.status);
        }
      }
    }

    res.json(
      rows.map((row) => ({
        ...row,
        smsStatus: latestSmsStatus.get(row.id) ?? null,
      })),
    );
  }),
);
