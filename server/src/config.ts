const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  webOrigin: env.WEB_ORIGIN ?? 'http://localhost:5173',
  github: {
    clientId: env.GITHUB_CLIENT_ID ?? '',
    clientSecret: env.GITHUB_CLIENT_SECRET ?? '',
    callbackUrl: env.GITHUB_CALLBACK_URL ?? 'http://localhost:3000/api/auth/github/callback',
  },
  gemini: {
    apiKey: env.GEMINI_API_KEY ?? '',
    model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  },
  thrivevas: {
    apiKey: env.THRIVEVAS_API_KEY ?? '',
    senderId: env.THRIVEVAS_SENDER_ID ?? '',
    callbackUrl: env.THRIVEVAS_CALLBACK_URL ?? 'http://localhost:3000/api/sms/dlr',
  },
};

export function isGithubConfigured(): boolean {
  return Boolean(config.github.clientId && config.github.clientSecret);
}
