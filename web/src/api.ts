export type Role = 'applicant' | 'recruiter' | 'admin';

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
}

export interface InviteAssessmentSummary {
  id: string;
  status: string;
  totalScore: number | null;
  applicantUsername: string;
  smsStatus: string | null;
}

export interface Invite {
  id: string;
  token: string;
  focusArea: string;
  status: 'pending' | 'used';
  createdAt: string;
  recruiterUsername: string;
  link: string;
  assessment: InviteAssessmentSummary | null;
}

export interface PublicInvite {
  focusArea: string;
  status: 'pending' | 'used';
  recruiterUsername: string;
}

export interface Repo {
  fullName: string;
  name: string;
  language: string | null;
  updatedAt: string;
}

export interface Question {
  id: string;
  position: number;
  text: string;
}

export interface Answer {
  questionId: string;
  text: string;
  score: number | null;
  feedback: string | null;
}

export interface Assessment {
  id: string;
  repoFullName: string;
  focusArea: string;
  status: string;
  totalScore: number | null;
  phone: string | null;
  consentSms: boolean;
  questions: Question[];
  answers: Answer[];
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
}

export interface AdminAssessment {
  id: string;
  focusArea: string;
  repoFullName: string;
  status: string;
  totalScore: number | null;
  applicantUsername: string;
  smsStatus: string | null;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function getMe(): Promise<CurrentUser | null> {
  const response = await fetch('/api/me');
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as CurrentUser;
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok) throw new Error(await readError(response));
}

export async function createInvite(focusArea: string): Promise<Invite> {
  const response = await fetch('/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ focusArea }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Invite;
}

export async function listInvites(): Promise<Invite[]> {
  const response = await fetch('/api/invites');
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Invite[];
}

export async function getPublicInvite(token: string): Promise<PublicInvite | null> {
  const response = await fetch(`/api/invites/token/${encodeURIComponent(token)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PublicInvite;
}

export async function listRepos(): Promise<Repo[]> {
  const response = await fetch('/api/repos');
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Repo[];
}

export async function createAssessment(input: {
  inviteToken: string;
  repoFullName: string;
  consentLlm: boolean;
}): Promise<Assessment> {
  const response = await fetch('/api/assessments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Assessment;
}

export async function getAssessment(id: string): Promise<Assessment> {
  const response = await fetch(`/api/assessments/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Assessment;
}

export async function submitAnswers(
  id: string,
  answers: { questionId: string; text: string }[],
): Promise<void> {
  const response = await fetch(`/api/assessments/${encodeURIComponent(id)}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function scoreAssessment(id: string): Promise<Assessment> {
  const response = await fetch(`/api/assessments/${encodeURIComponent(id)}/score`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Assessment;
}

export async function sendScoreSms(
  id: string,
  phone: string,
  consentSms: boolean,
): Promise<{ status: string; msisdn: string }> {
  const response = await fetch(`/api/assessments/${encodeURIComponent(id)}/send-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, consentSms }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { status: string; msisdn: string };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await fetch('/api/admin/users');
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AdminUser[];
}

export async function updateUserRole(
  id: string,
  role: Role,
): Promise<{ id: string; username: string; role: Role }> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { id: string; username: string; role: Role };
}

export async function getAdminAssessments(): Promise<AdminAssessment[]> {
  const response = await fetch('/api/admin/assessments');
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AdminAssessment[];
}
