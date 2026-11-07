import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { smsLogs } from '../db/schema.js';
import { asyncHandler } from '../http.js';

export const smsRouter = Router();

smsRouter.post(
  '/dlr',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as {
      transaction_id?: unknown;
      status?: unknown;
      msisdn?: unknown;
      status_description?: unknown;
      network?: unknown;
      country?: unknown;
    };

    const transactionId =
      body.transaction_id !== undefined ? String(body.transaction_id) : '';
    const statusCode = Number(body.status);

    if (transactionId) {
      const rows = await db
        .select()
        .from(smsLogs)
        .where(eq(smsLogs.transactionId, transactionId))
        .orderBy(desc(smsLogs.createdAt))
        .limit(1);
      const log = rows[0];

      if (log) {
        const status =
          statusCode === 3
            ? 'delivered'
            : statusCode === 2
              ? 'sent'
              : statusCode === 0 || statusCode === 1
                ? 'failed'
                : log.status;

        await db
          .update(smsLogs)
          .set({ status, dlrPayload: JSON.stringify(body), updatedAt: new Date() })
          .where(eq(smsLogs.id, log.id));
      }
    }

    res.json({ ok: true });
  }),
);
