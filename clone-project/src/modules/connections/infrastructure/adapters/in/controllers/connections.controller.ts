import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  Request,
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { User } from '@modules/auth/domain/user.entity';
import { Snowflake } from '@shared/snowflake/snowflake';
import {
  ConnectionProvider,
  SUPPORTED_PROVIDERS,
} from '@modules/connections/domain/connection.types';
import { DrizzleConnectionRepository } from '../../out/drizzle-connection.repository';
import { OAuthProviderService } from '@modules/connections/application/oauth-provider.service';
import { LinkConnectionDto, UpdateConnectionDto } from '../dtos/connection.dto';

@ApiTags('Connections & Authorized Apps')
@Controller()
export class ConnectionsController {
  constructor(
    private readonly repo: DrizzleConnectionRepository,
    private readonly oauthService: OAuthProviderService,
    private readonly jwtService: JwtService,
  ) {}

  private resolveBaseUrl(req: ExpressRequest): string {
    const configured = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').trim();
    if (configured) return configured.replace(/\/+$/, '');
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers['host'] || 'localhost:3000';
    return `${proto}://${host}`;
  }

  private parseProvider(raw: string): ConnectionProvider {
    const p = (raw || '').toLowerCase().trim() as ConnectionProvider;
    if (!SUPPORTED_PROVIDERS.includes(p)) {
      throw new BadRequestException(`Provedor não suportado: ${raw}`);
    }
    return p;
  }

  @Get('users/@me/connections')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List authenticated user linked external connections' })
  async listMyConnections(@Request() req: { user: User }) {
    const connections = await this.repo.findUserConnections(req.user.id);
    const oauthAvailable = this.oauthService.getProviderOAuthAvailability();
    return {
      connections,
      oauthAvailable,
    };
  }

  @Get('users/@me/connections/:provider/authorize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate OAuth2 / OpenID authorization URL for a provider' })
  getAuthorizeUrl(
    @Param('provider') rawProvider: string,
    @Request() reqUser: { user: User },
    @Req() req: ExpressRequest,
  ) {
    const provider = this.parseProvider(rawProvider);
    const baseUrl = this.resolveBaseUrl(req);
    const stateToken = this.jwtService.sign(
      { sub: reqUser.user.id, provider, purpose: 'connection_oauth' },
      { expiresIn: '15m' },
    );

    const authorizeUrl = this.oauthService.buildAuthorizeUrl(provider, baseUrl, stateToken);
    if (authorizeUrl) {
      return {
        mode: 'oauth',
        provider,
        authorizeUrl,
      };
    }

    return {
      mode: 'sync',
      provider,
      authorizeUrl: null,
    };
  }

  @Get('connections/callback/:provider')
  @ApiOperation({ summary: 'OAuth2 / OpenID callback endpoint for external account linking' })
  async handleOAuthCallback(
    @Param('provider') rawProvider: string,
    @Query() query: Record<string, string | undefined>,
    @Req() req: ExpressRequest,
    @Res() res: ExpressResponse,
  ) {
    const provider = this.parseProvider(rawProvider);
    const stateToken = (query.state || '').trim();

    try {
      if (!stateToken) {
        throw new BadRequestException('Token de estado OAuth ausente.');
      }

      const decoded = this.jwtService.verify<{
        sub: string;
        provider: ConnectionProvider;
        purpose: string;
      }>(stateToken);

      if (!decoded?.sub || decoded.purpose !== 'connection_oauth') {
        throw new BadRequestException('Sessão OAuth inválida ou expirada.');
      }

      const baseUrl = this.resolveBaseUrl(req);
      const account = await this.oauthService.exchangeOAuthCallback(provider, query, baseUrl);

      const saved = await this.repo.upsertConnection({
        id: Snowflake.generate(),
        userId: decoded.sub,
        provider,
        providerAccountId: account.providerAccountId,
        providerUsername: account.providerUsername,
        profileUrl: account.profileUrl,
        avatarUrl: account.avatarUrl,
        accessToken: account.accessToken ?? null,
        refreshToken: account.refreshToken ?? null,
        showOnProfile: true,
        metadata: account.metadata ? JSON.stringify(account.metadata) : null,
        connectedAt: new Date(),
      });

      const payloadJson = JSON.stringify({
        type: 'SYNCCORD_OAUTH_COMPLETE',
        success: true,
        provider,
        connection: saved,
      }).replace(/</g, '\\u003c');

      return res
        .status(HttpStatus.OK)
        .type('text/html')
        .send(this.renderPopupResultHtml(true, provider, saved.providerUsername, payloadJson));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na vinculação OAuth.';
      const payloadJson = JSON.stringify({
        type: 'SYNCCORD_OAUTH_COMPLETE',
        success: false,
        provider,
        error: msg,
      }).replace(/</g, '\\u003c');

      return res
        .status(HttpStatus.OK)
        .type('text/html')
        .send(this.renderPopupResultHtml(false, provider, msg, payloadJson));
    }
  }

  @Post('users/@me/connections')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Synchronize and link an external account for the logged-in user' })
  async linkConnection(
    @Request() req: { user: User },
    @Body() dto: LinkConnectionDto,
  ) {
    const conn = await this.oauthService.resolveDirectAccountSync(
      dto.provider,
      dto.handle,
      req.user,
    );
    if (typeof dto.showOnProfile === 'boolean') {
      conn.showOnProfile = dto.showOnProfile;
    }
    const saved = await this.repo.upsertConnection(conn);
    return saved;
  }

  @Patch('users/@me/connections/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle connection visibility on user profile' })
  async updateConnection(
    @Request() req: { user: User },
    @Param('provider') rawProvider: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    const provider = this.parseProvider(rawProvider);
    const updated = await this.repo.updateVisibility(req.user.id, provider, dto.showOnProfile);
    if (!updated) {
      throw new NotFoundException('Conexão não encontrada.');
    }
    return updated;
  }

  @Delete('users/@me/connections/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an external account from current user' })
  async unlinkConnection(
    @Request() req: { user: User },
    @Param('provider') rawProvider: string,
  ) {
    const provider = this.parseProvider(rawProvider);
    await this.repo.deleteConnection(req.user.id, provider);
    return { unlinked: true, provider };
  }

  @Get('users/@me/authorized-apps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List real authorized OAuth2 applications for current user' })
  async listAuthorizedApps(@Request() req: { user: User }) {
    return this.repo.findAuthorizedApps(req.user.id);
  }

  @Delete('users/@me/authorized-apps/:appId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an authorized OAuth2 application' })
  async revokeAuthorizedApp(
    @Request() req: { user: User },
    @Param('appId') appId: string,
  ) {
    await this.repo.revokeAuthorizedApp(req.user.id, appId);
    return { revoked: true, id: appId };
  }

  private renderPopupResultHtml(
    success: boolean,
    provider: string,
    detail: string,
    payloadJson: string,
  ): string {
    const safeDetail = detail
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const color = success ? '#00E699' : '#f23f43';
    const title = success ? 'Conta sincronizada com sucesso!' : 'Não foi possível concluir';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>SyncCord — ${provider.toUpperCase()}</title>
  <style>
    body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center; background: #090314; color: #f5f3ff; font-family: system-ui, sans-serif; text-align: center; }
    .card { background: rgba(18, 7, 36, 0.92); border: 1px solid ${color}; border-radius: 18px; padding: 28px 32px; max-width: 380px; box-shadow: 0 20px 50px rgba(0,0,0,0.7); }
    h2 { margin: 0 0 8px 0; color: ${color}; font-size: 18px; }
    p { margin: 0 0 16px 0; font-size: 13px; color: #d8b4fe; }
    button { background: #7c3aed; color: #fff; border: none; border-radius: 8px; padding: 8px 18px; cursor: pointer; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${title}</h2>
    <p>${safeDetail}</p>
    <button onclick="window.close()">Fechar Janela</button>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(${payloadJson}, '*');
      }
    } catch (e) {}
    setTimeout(() => { try { window.close(); } catch (e) {} }, 1200);
  </script>
</body>
</html>`;
  }
}
