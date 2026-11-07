import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  createAssessment,
  createInvite,
  getAdminAssessments,
  getAdminUsers,
  getAssessment,
  getMe,
  getPublicInvite,
  listInvites,
  listRepos,
  logout,
  scoreAssessment,
  sendScoreSms,
  submitAnswers,
  updateUserRole,
  type AdminAssessment,
  type AdminUser,
  type AnswerSignals,
  type Assessment,
  type CurrentUser,
  type Invite,
  type PublicInvite,
  type Repo,
  type Role,
} from './api';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const inviteToken = location.pathname.match(/^\/invite\/([^/]+)$/)?.[1];
  const pathAssessmentId = location.pathname.match(/^\/assessment\/([^/]+)$/)?.[1];
  const activeAssessmentId = assessmentId ?? pathAssessmentId;

  function openAssessment(id: string) {
    history.pushState({}, '', `/assessment/${id}`);
    setAssessmentId(id);
  }

  return (
    <>
      <header className="nav">
        <a className="brand" href="/">
          <span className="brand-mark">RI</span>
          RepoInterview
        </a>
        {user && (
          <UserBar
            user={user}
            onLogout={async () => {
              await logout();
              setUser(null);
            }}
          />
        )}
      </header>

      <main className="page">
        {loading ? (
          <p className="center">Loading…</p>
        ) : activeAssessmentId ? (
          user ? (
            <AssessmentView id={activeAssessmentId} />
          ) : (
            <SignIn />
          )
        ) : inviteToken ? (
          <InviteView token={inviteToken} user={user} onGenerated={openAssessment} />
        ) : !user ? (
          <LandingPage />
        ) : (
          <Dashboard user={user} />
        )}
        {error && <p className="error">{error}</p>}
      </main>

      <footer className="footer">
        RepoInterview · code-grounded technical interviews · Gemini for questions & scoring · ThriveVAS for SMS
      </footer>
    </>
  );
}

function LandingPage() {
  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">Technical interviews, grounded in real code</p>
        <h1>
          Hire engineers who actually understand <span>your codebase</span>.
        </h1>
        <p className="lead">
          RepoInterview reads a candidate's public GitHub repo, writes questions about the exact area
          you care about, scores their answers, and texts the result. No generic quizzes.
        </p>
        <div className="hero-actions">
          <a className="button" href="/api/auth/github">
            Sign in with GitHub
          </a>
          <span className="muted">Free for public repos · no credit card</span>
        </div>
      </section>

      <section className="features">
        <article className="feature">
          <h3>Questions from the actual repo</h3>
          <p>
            Gemini reads the files around your focus area — auth, payments, data access — and writes
            specific questions about that code.
          </p>
        </article>
        <article className="feature">
          <h3>Automatic scoring</h3>
          <p>
            Each answer is graded 0–10 with a short feedback note, then rolled up into one clear
            percentage.
          </p>
        </article>
        <article className="feature">
          <h3>Score by SMS</h3>
          <p>
            The result is delivered straight to the applicant's phone through ThriveVAS, with
            delivery status tracked.
          </p>
        </article>
      </section>

      <section className="steps">
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Sign in with GitHub</strong>
            <span>Applicants and recruiters use one GitHub login. The first user becomes admin.</span>
          </li>
          <li>
            <strong>Send an invite</strong>
            <span>A recruiter picks a focus area and shares the invite link.</span>
          </li>
          <li>
            <strong>Pick a repo</strong>
            <span>The applicant chooses a public repo and consents to code being read.</span>
          </li>
          <li>
            <strong>Answer & score</strong>
            <span>Questions are generated from the code, then answers are graded automatically.</span>
          </li>
          <li>
            <strong>Text the score</strong>
            <span>The total score goes out by SMS — with consent and a valid Kenyan number.</span>
          </li>
        </ol>
      </section>

      <section className="roles">
        <div className="role">
          <h3>Applicant</h3>
          <p>Sign in, connect a repo, take the assessment, and get the score by SMS.</p>
        </div>
        <div className="role">
          <h3>Recruiter</h3>
          <p>Create invites, choose the focus area, and see each applicant's score and SMS status.</p>
        </div>
        <div className="role">
          <h3>Admin</h3>
          <p>Manage roles, and see every assessment and SMS status in one place.</p>
        </div>
      </section>

      <section className="cta">
        <h2>Interview against real code, not trivia.</h2>
        <a className="button" href="/api/auth/github">
          Get started with GitHub
        </a>
      </section>
    </div>
  );
}

function SignIn() {
  return (
    <section className="panel stack">
      <h2>Sign in required</h2>
      <p className="muted">Sign in with GitHub to continue.</p>
      <a className="button" href="/api/auth/github">
        Sign in with GitHub
      </a>
    </section>
  );
}

function UserBar({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  return (
    <div className="user">
      {user.avatarUrl && <img src={user.avatarUrl} alt="GitHub avatar" width={32} height={32} />}
      <div>
        <strong>{user.displayName ?? user.username}</strong>
        <span>
          @{user.username} · {user.role}
        </span>
      </div>
      <button type="button" onClick={onLogout}>
        Sign out
      </button>
    </div>
  );
}

function Dashboard({ user }: { user: CurrentUser }) {
  return (
    <div className="dashboard">
      <section className="welcome">
        <h1>
          {user.role === 'applicant'
            ? `Hi, ${user.displayName ?? user.username}`
            : 'Recruiter dashboard'}
        </h1>
        <p className="muted">
          {user.role === 'applicant'
            ? 'Open an invite link from a recruiter to start an assessment.'
            : 'Create an invite, share the link, and watch scores and SMS delivery come in.'}
        </p>
      </section>

      {user.role === 'applicant' ? (
        <section className="panel stack">
          <h2>Waiting for an invite</h2>
          <p className="muted">
            When a recruiter sends you a link, open it to pick one of your public repos and take the
            assessment.
          </p>
        </section>
      ) : (
        <>
          <RecruiterDashboard />
          {user.role === 'admin' && <AdminPanel />}
        </>
      )}
    </div>
  );
}

function RecruiterDashboard() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [focusArea, setFocusArea] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    listInvites()
      .then(setInvites)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const invite = await createInvite(focusArea);
      setInvites((current) => [invite, ...current]);
      setFocusArea('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCopy(invite: Invite) {
    await navigator.clipboard.writeText(invite.link);
    setCopied(invite.token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="panel stack">
      <h2>Create an invite</h2>
      <form className="row" onSubmit={handleSubmit}>
        <input
          value={focusArea}
          onChange={(event) => setFocusArea(event.target.value)}
          placeholder="Focus area, e.g. authentication"
        />
        <button type="submit">Create</button>
      </form>
      {error && <p className="error">{error}</p>}

      <h2>Your invites</h2>
      {invites.length === 0 ? (
        <p className="muted">No invites yet.</p>
      ) : (
        <ul className="list">
          {invites.map((invite) => (
            <li key={invite.id}>
              <div>
                <strong>{invite.focusArea}</strong>
                <span>
                  {invite.status} · {new Date(invite.createdAt).toLocaleDateString()}
                </span>
                {invite.assessment && (
                  <span>
                    @{invite.assessment.applicantUsername} ·{' '}
                    {invite.assessment.totalScore !== null
                      ? `${invite.assessment.totalScore}%`
                      : invite.assessment.status}{' '}
                    · SMS: {invite.assessment.smsStatus ?? 'not sent'}
                  </span>
                )}
                {invite.assessment?.aiSummary && (
                  <span className="hint">
                    AI hint: {invite.assessment.aiSummary.level}
                    {invite.assessment.aiSummary.reasons.length > 0
                      ? ` — ${invite.assessment.aiSummary.reasons.join(', ')}`
                      : ''}{' '}
                    (advisory)
                  </span>
                )}
              </div>
              <button type="button" onClick={() => handleCopy(invite)}>
                {copied === invite.token ? 'Copied!' : 'Copy link'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InviteView({
  token,
  user,
  onGenerated,
}: {
  token: string;
  user: CurrentUser | null;
  onGenerated: (id: string) => void;
}) {
  const [invite, setInvite] = useState<PublicInvite | null | 'missing'>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoFullName, setRepoFullName] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPublicInvite(token)
      .then((result) => setInvite(result ?? 'missing'))
      .catch(() => setInvite('missing'));
  }, [token]);

  useEffect(() => {
    if (!user) return;
    listRepos()
      .then((list) => {
        setRepos(list);
        setRepoFullName((current) => current || list[0]?.fullName || '');
      })
      .catch((err: Error) => setError(err.message));
  }, [user]);

  if (invite === null) return <p className="center">Loading invite…</p>;
  if (invite === 'missing') {
    return (
      <section className="panel stack">
        <h2>Invite not found</h2>
        <p className="error">This invite link is invalid.</p>
      </section>
    );
  }

  async function handleStart(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const assessment = await createAssessment({
        inviteToken: token,
        repoFullName,
        consentLlm: consent,
      });
      onGenerated(assessment.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <h2>Assessment invite</h2>
      <p>
        Focus area: <strong>{invite.focusArea}</strong> · invited by @{invite.recruiterUsername}
      </p>
      {invite.status === 'used' && <p className="error">This invite has already been used.</p>}
      {!user ? (
        <a className="button" href="/api/auth/github">
          Sign in with GitHub to continue
        </a>
      ) : (
        <form className="stack" onSubmit={handleStart}>
          <label className="field">
            Repository
            <select value={repoFullName} onChange={(event) => setRepoFullName(event.target.value)}>
              {repos.map((repo) => (
                <option key={repo.fullName} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I agree that code from this public repository will be sent to Google Gemini to generate
            questions.
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy || !repoFullName || !consent}>
            {busy ? 'Generating…' : 'Start assessment'}
          </button>
        </form>
      )}
    </section>
  );
}

function AssessmentView({ id }: { id: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [consentSms, setConsentSms] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const signalsRef = useRef<
    Record<string, { focusMs: number; keystrokes: number; pasteCount: number; pastedChars: number }>
  >({});
  const focusStartRef = useRef<Record<string, number>>({});

  function ensureSignal(questionId: string) {
    signalsRef.current[questionId] ??= {
      focusMs: 0,
      keystrokes: 0,
      pasteCount: 0,
      pastedChars: 0,
    };
    return signalsRef.current[questionId];
  }

  useEffect(() => {
    getAssessment(id)
      .then((result) => {
        setAssessment(result);
        const saved: Record<string, string> = {};
        for (const answer of result.answers) {
          saved[answer.questionId] = answer.text;
        }
        setAnswers(saved);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error && !assessment) {
    return (
      <section className="panel stack">
        <h2>Assessment</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!assessment) return <p className="center">Loading assessment…</p>;

  const readOnly = assessment.status !== 'questions_ready';
  const canScore = assessment.status === 'submitted';
  const allAnswered = assessment.questions.every(
    (question) => (answers[question.id] ?? '').trim().length > 0,
  );
  const answerByQuestion = new Map(
    assessment.answers.map((answer) => [answer.questionId, answer]),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const now = Date.now();
      const signals: AnswerSignals[] = assessment!.questions.map((question) => {
        const signal = signalsRef.current[question.id] ?? {
          focusMs: 0,
          keystrokes: 0,
          pasteCount: 0,
          pastedChars: 0,
        };
        const startedAt = focusStartRef.current[question.id];
        return {
          questionId: question.id,
          focusMs: signal.focusMs + (startedAt ? now - startedAt : 0),
          keystrokes: signal.keystrokes,
          pasteCount: signal.pasteCount,
          pastedChars: signal.pastedChars,
        };
      });

      await submitAnswers(
        id,
        assessment!.questions.map((question) => ({
          questionId: question.id,
          text: answers[question.id] ?? '',
        })),
        signals,
      );
      setAssessment({ ...assessment!, status: 'submitted' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleScore() {
    setBusy(true);
    setError(null);
    try {
      setAssessment(await scoreAssessment(id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendSms() {
    setSmsBusy(true);
    setError(null);
    try {
      const result = await sendScoreSms(id, phone, consentSms);
      setAssessment((current) =>
        current
          ? { ...current, status: 'sms_sent', phone: result.msisdn, consentSms: true }
          : current,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSmsBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <h2>Assessment: {assessment.focusArea}</h2>
      <p className="muted">Repository: {assessment.repoFullName}</p>
      {assessment.totalScore !== null && (
        <p className="score">
          Total score: <strong>{assessment.totalScore}%</strong>
        </p>
      )}
      {readOnly && assessment.totalScore === null && (
        <p className="notice">Answers submitted. You can score them now.</p>
      )}
      <form className="stack" onSubmit={handleSubmit}>
        {assessment.questions.map((question) => {
          const graded = answerByQuestion.get(question.id);
          return (
            <QuestionField key={question.id}>
              <label className="field" htmlFor={`answer-${question.id}`}>
                {question.position}. {question.text}
              </label>
              <textarea
                id={`answer-${question.id}`}
                value={answers[question.id] ?? ''}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
                onFocus={() => {
                  focusStartRef.current[question.id] = Date.now();
                }}
                onBlur={() => {
                  const startedAt = focusStartRef.current[question.id];
                  if (startedAt) {
                    ensureSignal(question.id).focusMs += Date.now() - startedAt;
                    delete focusStartRef.current[question.id];
                  }
                }}
                onKeyDown={() => {
                  ensureSignal(question.id).keystrokes += 1;
                }}
                onPaste={(event) => {
                  const signal = ensureSignal(question.id);
                  signal.pasteCount += 1;
                  signal.pastedChars += event.clipboardData.getData('text').length;
                }}
                rows={3}
                readOnly={readOnly}
                placeholder="Type your answer…"
              />
              {graded?.score !== null && graded?.score !== undefined && (
                <p className="feedback">
                  Score: <strong>{graded.score}/10</strong>
                  {graded.feedback ? ` — ${graded.feedback}` : ''}
                </p>
              )}
            </QuestionField>
          );
        })}
        {error && <p className="error">{error}</p>}
        {!readOnly && (
          <button type="submit" disabled={busy || !allAnswered}>
            {busy ? 'Submitting…' : 'Submit answers'}
          </button>
        )}
        {canScore && (
          <button type="button" onClick={handleScore} disabled={busy}>
            {busy ? 'Scoring…' : 'Score my answers'}
          </button>
        )}
      </form>

      {assessment.status === 'scored' && (
        <div className="sms-box">
          <h3>Send the score by SMS</h3>
          <label className="field">
            Phone number (Kenya)
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0712345678"
            />
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={consentSms}
              onChange={(event) => setConsentSms(event.target.checked)}
            />
            I agree to receive my score by SMS.
          </label>
          <button
            type="button"
            onClick={handleSendSms}
            disabled={smsBusy || !consentSms || phone.trim().length === 0}
          >
            {smsBusy ? 'Sending…' : 'Send score by SMS'}
          </button>
        </div>
      )}

      {assessment.status === 'sms_sent' && (
        <p className="notice">
          Score sent by SMS{assessment.phone ? ` to ${assessment.phone}` : ''}.
        </p>
      )}
    </section>
  );
}

function QuestionField({ children }: { children: ReactNode }) {
  return <div className="question">{children}</div>;
}

function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [assessments, setAssessments] = useState<AdminAssessment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers()
      .then(setUsers)
      .catch((err: Error) => setError(err.message));
    getAdminAssessments()
      .then(setAssessments)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function changeRole(id: string, role: Role) {
    setError(null);
    try {
      const updated = await updateUserRole(id, role);
      setUsers((current) =>
        current.map((user) => (user.id === updated.id ? { ...user, role: updated.role } : user)),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="panel stack">
      <h2>Admin: users</h2>
      {error && <p className="error">{error}</p>}
      <ul className="list">
        {users.map((user) => (
          <li key={user.id}>
            <div>
              <strong>@{user.username}</strong>
              <span>{user.displayName ?? ''}</span>
            </div>
            <select
              value={user.role}
              onChange={(event) => changeRole(user.id, event.target.value as Role)}
            >
              <option value="applicant">applicant</option>
              <option value="recruiter">recruiter</option>
              <option value="admin">admin</option>
            </select>
          </li>
        ))}
      </ul>

      <h2>Admin: assessments & SMS</h2>
      {assessments.length === 0 ? (
        <p className="muted">No assessments yet.</p>
      ) : (
        <ul className="list">
          {assessments.map((assessment) => (
            <li key={assessment.id}>
              <div>
                <strong>{assessment.focusArea}</strong>
                <span>
                  @{assessment.applicantUsername} · {assessment.status} · SMS:{' '}
                  {assessment.smsStatus ?? 'not sent'}
                </span>
                {assessment.aiSummary && (
                  <span className="hint">
                    AI hint: {assessment.aiSummary.level}
                    {assessment.aiSummary.reasons.length > 0
                      ? ` — ${assessment.aiSummary.reasons.join(', ')}`
                      : ''}{' '}
                    (advisory)
                  </span>
                )}
              </div>
              <strong>{assessment.totalScore !== null ? `${assessment.totalScore}%` : '—'}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
