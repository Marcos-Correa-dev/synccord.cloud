import { URLSearchParams } from 'url';
import { ConnectionProvider } from '../domain/connection.types';

export class OAuthUrlBuilder {
  static getProviderOAuthAvailability(): Record<ConnectionProvider, boolean> {
    return {
      youtube: Boolean(
        (process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID) &&
          (process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET),
      ),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      spotify: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      steam: true,
      twitch: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
    };
  }

  static buildAuthorizeUrl(
    provider: ConnectionProvider,
    baseUrl: string,
    stateToken: string,
  ): string | null {
    const callbackUrl = `${baseUrl}/api/v10/connections/callback/${provider}`;

    switch (provider) {
      case 'steam': {
        const returnTo = `${callbackUrl}?state=${encodeURIComponent(stateToken)}`;
        const params = new URLSearchParams({
          'openid.ns': 'http://specs.openid.net/auth/2.0',
          'openid.mode': 'checkid_setup',
          'openid.return_to': returnTo,
          'openid.realm': baseUrl,
          'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
          'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
        });
        return `https://steamcommunity.com/openid/login?${params.toString()}`;
      }
      case 'youtube': {
        const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '').trim();
        if (!clientId) return null;
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          response_type: 'code',
          access_type: 'offline',
          prompt: 'consent',
          scope: 'openid email profile https://www.googleapis.com/auth/youtube.readonly',
          state: stateToken,
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      }
      case 'github': {
        const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
        if (!clientId) return null;
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          scope: 'read:user user:email',
          state: stateToken,
        });
        return `https://github.com/login/oauth/authorize?${params.toString()}`;
      }
      case 'spotify': {
        const clientId = (process.env.SPOTIFY_CLIENT_ID || '').trim();
        if (!clientId) return null;
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          response_type: 'code',
          scope: 'user-read-private user-read-email',
          state: stateToken,
        });
        return `https://accounts.spotify.com/authorize?${params.toString()}`;
      }
      case 'twitch': {
        const clientId = (process.env.TWITCH_CLIENT_ID || '').trim();
        if (!clientId) return null;
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          response_type: 'code',
          scope: 'user:read:email',
          state: stateToken,
        });
        return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
      }
    }
  }
}
