import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  githubId: integer('github_id').notNull().unique(),
  username: text('username').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['applicant', 'recruiter', 'admin'] })
    .notNull()
    .default('applicant'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  githubAccessToken: text('github_access_token'),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});

export const invites = sqliteTable('invites', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  token: text('token').notNull().unique(),
  recruiterId: text('recruiter_id')
    .notNull()
    .references(() => users.id),
  focusArea: text('focus_area').notNull(),
  status: text('status', { enum: ['pending', 'used'] })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const assessments = sqliteTable('assessments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  inviteId: text('invite_id')
    .notNull()
    .references(() => invites.id),
  applicantId: text('applicant_id')
    .notNull()
    .references(() => users.id),
  repoFullName: text('repo_full_name').notNull(),
  focusArea: text('focus_area').notNull(),
  consentLlm: integer('consent_llm', { mode: 'boolean' })
    .notNull()
    .default(false),
  consentSms: integer('consent_sms', { mode: 'boolean' })
    .notNull()
    .default(false),
  phone: text('phone'),
  status: text('status', {
    enum: ['accepted', 'questions_ready', 'submitted', 'scored', 'sms_sent'],
  })
    .notNull()
    .default('accepted'),
  totalScore: integer('total_score'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const questions = sqliteTable('questions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id')
    .notNull()
    .references(() => assessments.id),
  position: integer('position').notNull(),
  text: text('text').notNull(),
});

export const answers = sqliteTable('answers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id),
  assessmentId: text('assessment_id')
    .notNull()
    .references(() => assessments.id),
  text: text('text').notNull(),
  score: integer('score'),
  feedback: text('feedback'),
});

export const smsLogs = sqliteTable('sms_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id')
    .notNull()
    .references(() => assessments.id),
  msisdn: text('msisdn').notNull(),
  transactionId: text('transaction_id'),
  status: text('status', {
    enum: ['queued', 'sent', 'failed', 'delivered'],
  })
    .notNull()
    .default('queued'),
  dlrPayload: text('dlr_payload'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
