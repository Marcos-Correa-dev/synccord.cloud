export const SUPPORTED_PROVIDERS = [
  'youtube',
  'github',
  'spotify',
  'steam',
  'twitch',
] as const;

export type ConnectionProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface UserConnection {
  id: string;
  userId: string;
  provider: ConnectionProvider;
  providerAccountId: string;
  providerUsername: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  showOnProfile: boolean;
  metadata?: string | null;
  connectedAt: Date;
}

export interface AuthorizedApp {
  id: string;
  userId: string;
  appName: string;
  appIcon: string | null;
  scopes: string;
  authorizedAt: Date;
}
