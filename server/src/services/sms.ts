import { config } from '../config.js';

const SMS_ENDPOINT = 'https://sms.thrivevas.com/v1/message/send';

export interface SmsResult {
  transactionId: string;
  status: number;
  message: string;
}

export function normalizeKenyanPhone(input: string): string | null {
  let digits = input.replace(/[\s()-]/g, '');

  if (digits.startsWith('+254')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('254')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^[71]\d{8}$/.test(digits)) {
    return null;
  }

  return `+254${digits}`;
}

export async function sendSms(msisdn: string, message: string): Promise<SmsResult> {
  if (!config.thrivevas.apiKey) {
    throw new Error('THRIVEVAS_API_KEY is not configured');
  }

  const body: Record<string, string> = {
    message,
    msisdn,
    callback_url: config.thrivevas.callbackUrl,
  };

  if (config.thrivevas.senderId.trim().length > 0) {
    body.sender_id = config.thrivevas.senderId.trim();
  }

  const response = await fetch(SMS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.thrivevas.apiKey,
    },
    body: JSON.stringify(body),
  });

  let data: {
    status?: number;
    message?: string;
    transaction_id?: number | string;
  } = {};

  try {
    data = (await response.json()) as typeof data;
  } catch {
    data = {};
  }

  if (!response.ok || (data.status !== undefined && data.status >= 400) || data.transaction_id === undefined) {
    throw new Error(data.message ?? `ThriveVAS request failed (${response.status})`);
  }

  return {
    transactionId: String(data.transaction_id),
    status: data.status ?? response.status,
    message: data.message ?? 'SMS queued',
  };
}
