export type AuthUser = {
  name: string;
  email: string;
};

/**
 * Demo-only account record. This app has no backend, so "auth" is a local
 * simulation stored in the browser's localStorage — passwords are kept in
 * plain text here, which is fine for a prototype but must never be done
 * against a real account system.
 */
export type AuthAccount = AuthUser & { password: string };

export const DEMO_ACCOUNT: AuthAccount = {
  name: 'Aiman Rashid',
  email: 'aiman@redlineauto.my',
  password: 'redline123',
};
