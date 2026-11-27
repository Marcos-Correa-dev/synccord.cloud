import { Injectable, BadRequestException } from '@nestjs/common';
import { Snowflake } from '@shared/snowflake/snowflake';
import { User } from '@modules/auth/domain/user.entity';
import { ConnectionProvider, UserConnection } from '../domain/connection.types';
import {
  PublicProfileLookupService,
  ResolvedExternalAccount,
} from './public-profile-lookup.service';
import { OAuthUrlBuilder } from './oauth-url-builder';

@Injectable()
export class OAuthProviderService {
  constructor(private readonly lookupService: PublicProfileLookupService) {}

  getProviderOAuthAvailability(): Record<ConnectionProvider, boolean> {
    return OAuthUrlBuilder.getProviderOAuthAvailability();
  }

  buildAuthorizeUrl(
    provider: ConnectionProvider,
    baseUrl: string,
    stateToken: string,
  ): string | null {
    return OAuthUrlBuilder.buildAuthorizeUrl(provider, baseUrl, stateToken);
  }

  async exchangeOAuthCallback(
    provider: ConnectionProvider,
    query: Record<string, string | undefined>,
    baseUrl: string,
  ): Promise<ResolvedExternalAccount> {
    const callbackUrl = `${baseUrl}/api/v10/connections/callback/${provider}`;

    if (provider === 'steam') {
      return this.verifySteamOpenId(query);
    }

    const code = (query.code || '').trim();
    if (!code) {
      throw new BadRequestException('Authorization code ausente no retorno OAuth2.');
    }

    switch (provider) {
      case 'youtube':
        return this.exchangeYouTubeCode(code, callbackUrl);
      case 'github':
        return this.exchangeGitHubCode(code, callbackUrl);
      case 'spotify':
        return this.exchangeSpotifyCode(code, callbackUrl);
      case 'twitch':
        return this.exchangeTwitchCode(code, callbackUrl);
    }
  }

  async resolveDirectAccountSync(
    provider: ConnectionProvider,
    rawHandle: string | undefined,
    user: User,
  ): Promise<UserConnection> {
    const cleaned = (rawHandle || '').trim();
    const resolved = await this.lookupService.lookup(provider, cleaned, user);

    return {
      id: Snowflake.generate(),
      userId: user.id,
      provider,
      providerAccountId: resolved.providerAccountId,
      providerUsername: resolved.providerUsername,
      profileUrl: resolved.profileUrl,
      avatarUrl: resolved.avatarUrl,
      accessToken: resolved.accessToken ?? null,
      refreshToken: resolved.refreshToken ?? null,
      showOnProfile: true,
      metadata: resolved.metadata ? JSON.stringify(resolved.metadata) : null,
      connectedAt: new Date(),
    };
  }

  private async verifySteamOpenId(
    query: Record<string, string | undefined>,
  ): Promise<ResolvedExternalAccount> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (k.startsWith('openid.') && typeof v === 'string') {
        params.set(k, v);
      }
    });
    params.set('openid.mode', 'check_authentication');

    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(8000),
    });
    const verifyText = await verifyRes.text();
    if (!verifyText.includes('is_valid:true')) {
      throw new BadRequestException('Falha ao autenticar assinatura OpenID da Steam.');
    }

    const claimedId = query['openid.claimed_id'] || '';
    const match = claimedId.match(/\/id\/(\d+)$/) || claimedId.match(/(\d{17})/);
    const steamId64 = match ? match[1] : '';
    if (!steamId64) {
      throw new BadRequestException('SteamID não identificado.');
    }

    const xmlProfile = await this.lookupService.fetchSteamXmlById64(steamId64);
    return {
      providerAccountId: steamId64,
      providerUsername: xmlProfile.personaName || `Steam #${steamId64.slice(-6)}`,
      profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
      avatarUrl: xmlProfile.avatarUrl,
      metadata: { steamId64, verifiedOpenId: true },
    };
  }

  private async exchangeYouTubeCode(
    code: string,
    redirectUri: string,
  ): Promise<ResolvedExternalAccount> {
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '').trim();
    const clientSecret = (
      process.env.GOOGLE_CLIENT_SECRET ||
      process.env.YOUTUBE_CLIENT_SECRET ||
      ''
    ).trim();

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenJson = (await tokenRes.json()) as Record<string, string>;
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new BadRequestException('Falha ao obter token OAuth2 do Google/YouTube.');
    }

    const accessToken = tokenJson.access_token;
    const ytRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const ytJson = (await ytRes.json()) as {
      items?: Array<{
        id: string;
        snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } };
        statistics?: { subscriberCount?: string };
      }>;
    };

    if (ytJson.items && ytJson.items.length > 0) {
      const ch = ytJson.items[0];
      const customHandle = ch.snippet?.customUrl || `channel/${ch.id}`;
      return {
        providerAccountId: ch.id,
        providerUsername: ch.snippet?.title || customHandle,
        profileUrl: customHandle.startsWith('@')
          ? `https://www.youtube.com/${customHandle}`
          : `https://www.youtube.com/channel/${ch.id}`,
        avatarUrl: ch.snippet?.thumbnails?.default?.url || null,
        accessToken,
        refreshToken: tokenJson.refresh_token || null,
        metadata: { subscribers: ch.statistics?.subscriberCount || '0' },
      };
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const uJson = (await userRes.json()) as { id?: string; name?: string; email?: string; picture?: string };
    return {
      providerAccountId: uJson.id || 'youtube_user',
      providerUsername: uJson.name || uJson.email || 'YouTube',
      profileUrl: 'https://www.youtube.com',
      avatarUrl: uJson.picture || null,
      accessToken,
      refreshToken: tokenJson.refresh_token || null,
    };
  }

  private async exchangeGitHubCode(
    code: string,
    redirectUri: string,
  ): Promise<ResolvedExternalAccount> {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: (process.env.GITHUB_CLIENT_ID || '').trim(),
        client_secret: (process.env.GITHUB_CLIENT_SECRET || '').trim(),
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new BadRequestException('Falha ao obter token OAuth2 do GitHub.');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'User-Agent': 'SyncCord-OAuth',
      },
    });
    const gh = (await userRes.json()) as {
      id: number;
      login: string;
      html_url: string;
      avatar_url?: string;
      public_repos?: number;
    };
    return {
      providerAccountId: String(gh.id),
      providerUsername: gh.login,
      profileUrl: gh.html_url || `https://github.com/${gh.login}`,
      avatarUrl: gh.avatar_url || null,
      accessToken: tokenJson.access_token,
      metadata: { publicRepos: gh.public_repos ?? 0 },
    };
  }

  private async exchangeSpotifyCode(
    code: string,
    redirectUri: string,
  ): Promise<ResolvedExternalAccount> {
    const creds = Buffer.from(
      `${(process.env.SPOTIFY_CLIENT_ID || '').trim()}:${(process.env.SPOTIFY_CLIENT_SECRET || '').trim()}`,
    ).toString('base64');

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
    if (!tokenJson.access_token) {
      throw new BadRequestException('Falha ao obter token OAuth2 do Spotify.');
    }

    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const sp = (await meRes.json()) as {
      id: string;
      display_name?: string;
      external_urls?: { spotify?: string };
      images?: Array<{ url?: string }>;
    };
    return {
      providerAccountId: sp.id,
      providerUsername: sp.display_name || sp.id,
      profileUrl: sp.external_urls?.spotify || `https://open.spotify.com/user/${sp.id}`,
      avatarUrl: sp.images?.[0]?.url || null,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
    };
  }

  private async exchangeTwitchCode(
    code: string,
    redirectUri: string,
  ): Promise<ResolvedExternalAccount> {
    const clientId = (process.env.TWITCH_CLIENT_ID || '').trim();
    const clientSecret = (process.env.TWITCH_CLIENT_SECRET || '').trim();

    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
    if (!tokenJson.access_token) {
      throw new BadRequestException('Falha ao obter token OAuth2 da Twitch.');
    }

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'Client-Id': clientId,
      },
    });
    const twJson = (await userRes.json()) as {
      data?: Array<{ id: string; login: string; display_name: string; profile_image_url?: string }>;
    };
    const tw = twJson.data?.[0];
    if (!tw) {
      throw new BadRequestException('Perfil Twitch não encontrado.');
    }
    return {
      providerAccountId: tw.id,
      providerUsername: tw.display_name || tw.login,
      profileUrl: `https://www.twitch.tv/${tw.login}`,
      avatarUrl: tw.profile_image_url || null,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
    };
  }
}
