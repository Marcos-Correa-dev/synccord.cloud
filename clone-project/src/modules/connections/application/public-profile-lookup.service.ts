import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { User } from '@modules/auth/domain/user.entity';
import { ConnectionProvider } from '../domain/connection.types';

export interface ResolvedExternalAccount {
  providerAccountId: string;
  providerUsername: string;
  profileUrl: string;
  avatarUrl: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PublicProfileLookupService {
  private readonly logger = new Logger(PublicProfileLookupService.name);

  async lookup(
    provider: ConnectionProvider,
    cleaned: string,
    user: User,
  ): Promise<ResolvedExternalAccount> {
    switch (provider) {
      case 'github':
        return this.lookupGitHubProfile(cleaned || user.username);
      case 'youtube':
        return this.lookupYouTubeProfile(cleaned, user);
      case 'spotify':
        return this.lookupSpotifyProfile(cleaned, user);
      case 'steam':
        return this.lookupSteamProfile(cleaned, user);
      case 'twitch':
        return this.lookupTwitchProfile(cleaned, user);
    }
  }

  async fetchSteamXmlById64(
    steamId64: string,
  ): Promise<{ personaName: string | null; avatarUrl: string | null }> {
    try {
      const res = await fetch(`https://steamcommunity.com/profiles/${steamId64}/?xml=1`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { personaName: null, avatarUrl: null };
      const xml = await res.text();
      const nameMatch = xml.match(/<steamID><!\[CDATA\[([^\]]+)\]\]><\/steamID>/i);
      const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[([^\]]+)\]\]><\/avatarFull>/i);
      return {
        personaName: nameMatch ? nameMatch[1].trim() : null,
        avatarUrl: avatarMatch ? avatarMatch[1].trim() : null,
      };
    } catch {
      return { personaName: null, avatarUrl: null };
    }
  }

  private async lookupGitHubProfile(input: string): Promise<ResolvedExternalAccount> {
    const clean = input
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/^@/, '')
      .split('/')[0]
      .trim();

    if (!clean) {
      throw new BadRequestException('Informe o usuário do GitHub.');
    }

    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(clean)}`, {
        headers: { 'User-Agent': 'SyncCord-Client/1.0', Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const gh = (await res.json()) as {
          id: number;
          login: string;
          html_url: string;
          avatar_url?: string;
          public_repos?: number;
          followers?: number;
        };
        return {
          providerAccountId: String(gh.id),
          providerUsername: gh.login,
          profileUrl: gh.html_url,
          avatarUrl: gh.avatar_url || null,
          metadata: { publicRepos: gh.public_repos ?? 0, followers: gh.followers ?? 0 },
        };
      }
    } catch (err) {
      this.logger.warn(`GitHub public lookup notice: ${String(err)}`);
    }

    return {
      providerAccountId: clean.toLowerCase(),
      providerUsername: clean,
      profileUrl: `https://github.com/${encodeURIComponent(clean)}`,
      avatarUrl: null,
    };
  }

  private async lookupYouTubeProfile(input: string, user: User): Promise<ResolvedExternalAccount> {
    const fallbackHandle = user.email.split('@')[0] || user.username;
    const raw = input || `@${fallbackHandle}`;
    let url: string;
    let handleLabel: string;

    if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(raw)) {
      url = raw;
      handleLabel = raw.replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').replace(/\/+$/, '');
    } else {
      const cleanHandle = raw.replace(/^@/, '').trim();
      handleLabel = `@${cleanHandle}`;
      url = `https://www.youtube.com/@${encodeURIComponent(cleanHandle)}`;
    }

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 SyncCordBot/1.0' },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const html = (await res.text()).slice(0, 200000);
        const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
        const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
        if (ogTitle && ogTitle !== 'YouTube') {
          return {
            providerAccountId: handleLabel.toLowerCase(),
            providerUsername: ogTitle.trim(),
            profileUrl: url,
            avatarUrl: ogImage || null,
            metadata: { syncedEmail: user.email },
          };
        }
      }
    } catch {}

    return {
      providerAccountId: handleLabel.toLowerCase(),
      providerUsername: input ? handleLabel : `${user.username} (${user.email})`,
      profileUrl: url,
      avatarUrl: user.avatar || null,
      metadata: { syncedEmail: user.email },
    };
  }

  private async lookupSpotifyProfile(input: string, user: User): Promise<ResolvedExternalAccount> {
    const clean = (input || user.username)
      .replace(/^https?:\/\/open\.spotify\.com\/user\//i, '')
      .replace(/^@/, '')
      .split('?')[0]
      .trim();
    return {
      providerAccountId: clean.toLowerCase(),
      providerUsername: clean,
      profileUrl: `https://open.spotify.com/user/${encodeURIComponent(clean)}`,
      avatarUrl: null,
    };
  }

  private async lookupSteamProfile(input: string, user: User): Promise<ResolvedExternalAccount> {
    const clean = (input || user.username)
      .replace(/^https?:\/\/steamcommunity\.com\/(id|profiles)\//i, '')
      .replace(/\/+$/, '')
      .trim();
    const isId64 = /^\d{17}$/.test(clean);
    const profileUrl = isId64
      ? `https://steamcommunity.com/profiles/${clean}`
      : `https://steamcommunity.com/id/${encodeURIComponent(clean)}`;

    if (isId64) {
      const xml = await this.fetchSteamXmlById64(clean);
      return {
        providerAccountId: clean,
        providerUsername: xml.personaName || clean,
        profileUrl,
        avatarUrl: xml.avatarUrl,
      };
    }

    return {
      providerAccountId: clean.toLowerCase(),
      providerUsername: clean,
      profileUrl,
      avatarUrl: null,
    };
  }

  private async lookupTwitchProfile(input: string, user: User): Promise<ResolvedExternalAccount> {
    const clean = (input || user.username)
      .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
      .replace(/^@/, '')
      .split('/')[0]
      .trim();
    return {
      providerAccountId: clean.toLowerCase(),
      providerUsername: clean,
      profileUrl: `https://www.twitch.tv/${encodeURIComponent(clean)}`,
      avatarUrl: null,
    };
  }
}
