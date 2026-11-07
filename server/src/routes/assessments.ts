import { Router } from 'express';
import { and, eq, type InferSelectModel } from 'drizzle-orm';
import { db } from '../db/client.js';
import { answers, assessments, invites, questions, smsLogs } from '../db/schema.js';
import { getSessionGithubToken, requireAuth } from '../auth/session.js';
import { asyncHandler } from '../http.js';
import { fetchRepoContext } from '../services/github.js';
import { generateQuestions, gradeAnswers } from '../services/gemini.js';
import { normalizeKenyanPhone, sendSms } from '../services/sms.js';

export const assessmentsRouter = Router();

type Assessment = InferSelectModel<typeof assessments>;

async function assessmentPayload(assessment: Assessment) {
  const questionRows = await db
    .select()
    .from(questions)
    .where(eq(questions.assessmentId, assessment.id))
    .orderBy(questions.position);

  const answerRows = await db
    .select()
    .from(answers)
    .where(eq(answers.assessmentId, assessment.id));

  return {
    id: assessment.id,
    repoFullName: assessment.repoFullName,
    focusArea: assessment.focusArea,
    status: assessment.status,
    totalScore: assessment.totalScore,
    phone: assessment.phone,
    consentSms: assessment.consentSms,
    questions: questionRows.map((question) => ({
      id: question.id,
      position: question.position,
      text: question.text,
    })),
    answers: answerRows.map((answer) => ({
      questionId: answer.questionId,
      text: answer.text,
      score: answer.score,
      feedback: answer.feedback,
    })),
  };
}

assessmentsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const inviteToken =
      typeof req.body?.inviteToken === 'string' ? req.body.inviteToken.trim() : '';
    const repoFullName =
      typeof req.body?.repoFullName === 'string' ? req.body.repoFullName.trim() : '';
    const consentLlm = req.body?.consentLlm === true;

    if (!inviteToken || !/^[\w.-]+\/[\w.-]+$/.test(repoFullName)) {
      res.status(400).json({ error: 'inviteToken and repoFullName (owner/name) are required' });
      return;
    }

    if (!consentLlm) {
      res
        .status(400)
        .json({ error: 'You must consent to sending repository code to Google Gemini' });
      return;
    }

    const inviteRows = await db
      .select()
      .from(invites)
      .where(eq(invites.token, inviteToken))
      .limit(1);
    const invite = inviteRows[0];

    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(409).json({ error: 'This invite has already been used' });
      return;
    }

    const githubToken = await getSessionGithubToken(req.sessionToken!);
    if (!githubToken) {
      res.status(401).json({ error: 'Sign in with GitHub again to allow repository access' });
      return;
    }

    let context;
    try {
      context = await fetchRepoContext(githubToken, repoFullName, invite.focusArea);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    let questionTexts: string[];
    try {
      questionTexts = await generateQuestions(repoFullName, invite.focusArea, context.text);
    } catch (error) {
      console.error('Question generation failed:', error);
      res
        .status(502)
        .json({ error: 'Question generation failed. Check the GEMINI_API_KEY setting.' });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [assessment] = await tx
        .insert(assessments)
        .values({
          inviteId: invite.id,
          applicantId: req.user!.id,
          repoFullName,
          focusArea: invite.focusArea,
          consentLlm: true,
          status: 'questions_ready',
        })
        .returning();

      const inserted = await tx
        .insert(questions)
        .values(
          questionTexts.map((text, index) => ({
            assessmentId: assessment.id,
            position: index + 1,
            text,
          })),
        )
        .returning();

      await tx.update(invites).set({ status: 'used' }).where(eq(invites.id, invite.id));

      return { assessment, questions: inserted };
    });

    res.status(201).json({
      id: result.assessment.id,
      repoFullName: result.assessment.repoFullName,
      focusArea: result.assessment.focusArea,
      status: result.assessment.status,
      totalScore: null,
      questions: result.questions.map((question) => ({
        id: question.id,
        position: question.position,
        text: question.text,
      })),
      answers: [],
    });
  }),
);

assessmentsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const rows = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
    const assessment = rows[0];

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    const user = req.user!;
    let allowed = user.role === 'admin' || assessment.applicantId === user.id;

    if (!allowed && user.role === 'recruiter') {
      const inviteRows = await db
        .select()
        .from(invites)
        .where(eq(invites.id, assessment.inviteId))
        .limit(1);
      allowed = inviteRows[0]?.recruiterId === user.id;
    }

    if (!allowed) {
      res.status(403).json({ error: 'You do not have permission to view that assessment' });
      return;
    }

    res.json(await assessmentPayload(assessment));
  }),
);

assessmentsRouter.post(
  '/:id/answers',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const rows = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
    const assessment = rows[0];

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    if (assessment.applicantId !== req.user!.id) {
      res.status(403).json({ error: 'Only the applicant can answer this assessment' });
      return;
    }

    if (assessment.status !== 'questions_ready' && assessment.status !== 'submitted') {
      res.status(409).json({ error: 'This assessment can no longer be answered' });
      return;
    }

    const input = req.body?.answers;
    if (!Array.isArray(input)) {
      res.status(400).json({ error: 'An answers array is required' });
      return;
    }

    const questionRows = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessment.id));
    const questionIds = new Set(questionRows.map((question) => question.id));

    const parsed: { questionId: string; text: string }[] = [];
    const seen = new Set<string>();

    for (const item of input as Array<{ questionId?: unknown; text?: unknown }>) {
      const questionId = typeof item?.questionId === 'string' ? item.questionId : '';
      const text = typeof item?.text === 'string' ? item.text.trim() : '';

      if (!questionIds.has(questionId) || seen.has(questionId)) {
        res.status(400).json({ error: 'The answers contain an invalid question' });
        return;
      }

      if (text.length === 0 || text.length > 5000) {
        res.status(400).json({ error: 'Each answer must be between 1 and 5000 characters' });
        return;
      }

      seen.add(questionId);
      parsed.push({ questionId, text });
    }

    if (seen.size !== questionIds.size) {
      res.status(400).json({ error: 'Please answer every question' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(answers).where(eq(answers.assessmentId, assessment.id));
      await tx.insert(answers).values(
        parsed.map((answer) => ({
          questionId: answer.questionId,
          assessmentId: assessment.id,
          text: answer.text,
        })),
      );
      await tx
        .update(assessments)
        .set({ status: 'submitted' })
        .where(eq(assessments.id, assessment.id));
    });

    res.json({ status: 'submitted' });
  }),
);

assessmentsRouter.post(
  '/:id/score',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const rows = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
    const assessment = rows[0];

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    const user = req.user!;
    if (assessment.applicantId !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to score that assessment' });
      return;
    }

    if (assessment.status === 'scored' || assessment.status === 'sms_sent') {
      res.json(await assessmentPayload(assessment));
      return;
    }

    if (assessment.status !== 'submitted') {
      res.status(409).json({ error: 'Answers must be submitted before scoring' });
      return;
    }

    const questionRows = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessment.id))
      .orderBy(questions.position);
    const answerRows = await db
      .select()
      .from(answers)
      .where(eq(answers.assessmentId, assessment.id));
    const answerByQuestion = new Map(answerRows.map((answer) => [answer.questionId, answer]));

    if (
      questionRows.length === 0 ||
      questionRows.some((question) => !answerByQuestion.has(question.id))
    ) {
      res.status(409).json({ error: 'Answers are incomplete' });
      return;
    }

    let graded;
    try {
      graded = await gradeAnswers(
        assessment.focusArea,
        assessment.repoFullName,
        questionRows.map((question) => ({
          question: question.text,
          answer: answerByQuestion.get(question.id)!.text,
        })),
      );
    } catch (error) {
      console.error('Scoring failed:', error);
      res.status(502).json({ error: 'Scoring failed. Check the GEMINI_API_KEY setting.' });
      return;
    }

    const totalScore = Math.round(
      (graded.reduce((sum, item) => sum + item.score, 0) / (graded.length * 10)) * 100,
    );

    await db.transaction(async (tx) => {
      for (let index = 0; index < questionRows.length; index += 1) {
        const gradedItem = graded![index];
        await tx
          .update(answers)
          .set({ score: gradedItem.score, feedback: gradedItem.feedback })
          .where(
            and(
              eq(answers.assessmentId, assessment.id),
              eq(answers.questionId, questionRows[index].id),
            ),
          );
      }
      await tx
        .update(assessments)
        .set({ status: 'scored', totalScore })
        .where(eq(assessments.id, assessment.id));
    });

    const updatedRows = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessment.id))
      .limit(1);
    res.json(await assessmentPayload(updatedRows[0]));
  }),
);

assessmentsRouter.post(
  '/:id/send-sms',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const rows = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
    const assessment = rows[0];

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    const user = req.user!;
    if (assessment.applicantId !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to send this SMS' });
      return;
    }

    if (assessment.status === 'sms_sent') {
      res.status(409).json({ error: 'The score has already been sent by SMS' });
      return;
    }

    if (assessment.status !== 'scored') {
      res.status(409).json({ error: 'The assessment must be scored before sending the score' });
      return;
    }

    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const consentSms = req.body?.consentSms === true;

    if (!consentSms) {
      res.status(400).json({ error: 'You must consent to receive the score by SMS' });
      return;
    }

    const msisdn = normalizeKenyanPhone(phone);
    if (!msisdn) {
      res.status(400).json({ error: 'Enter a valid Kenyan phone number, e.g. 0712345678' });
      return;
    }

    const message = `RepoInterview: you scored ${assessment.totalScore}% on the ${assessment.focusArea} assessment.`;

    try {
      const result = await sendSms(msisdn, message);
      await db.insert(smsLogs).values({
        assessmentId: assessment.id,
        msisdn,
        transactionId: result.transactionId,
        status: 'sent',
      });
      await db
        .update(assessments)
        .set({ phone: msisdn, consentSms: true, status: 'sms_sent' })
        .where(eq(assessments.id, assessment.id));

      res.json({ status: 'sms_sent', msisdn });
    } catch (error) {
      console.error('SMS sending failed:', error);
      await db.insert(smsLogs).values({
        assessmentId: assessment.id,
        msisdn,
        status: 'failed',
        dlrPayload: JSON.stringify({ error: (error as Error).message }),
      });
      res.status(502).json({ error: (error as Error).message || 'SMS sending failed' });
    }
  }),
);
