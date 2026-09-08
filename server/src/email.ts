import type { Env } from './index';

const DEFAULT_FROM = 'Redline CRM <onboarding@resend.dev>';

/** Fire-and-forget-ish: throws on a hard API failure so the caller can decide how to respond, but
 *  never leaks whether the recipient's account actually exists (caller controls that). */
export async function sendPasswordResetEmail(env: Env, to: string, resetLink: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || DEFAULT_FROM,
      to: [to],
      subject: 'Reset your Redline password',
      html: `
        <p>We received a request to reset your Redline CRM password.</p>
        <p><a href="${resetLink}">Click here to choose a new password</a>. This link expires in 30 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    }),
  });
  if (!res.ok) {
    console.error('Resend API error', res.status, await res.text().catch(() => ''));
    throw new Error('Failed to send reset email');
  }
}
