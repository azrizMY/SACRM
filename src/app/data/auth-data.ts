export type AuthUser = {
  id: string;
  name: string;
  email: string;
  publicToken: string;
  /** 'owner' for the site owner/admin; everyone else is 'user'. */
  role: 'user' | 'owner';
};
