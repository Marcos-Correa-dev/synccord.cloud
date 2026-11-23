import { Controller, Get, Req, Res, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { join } from 'path';

@ApiTags('Root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'SyncCord Web App root interface' })
  @ApiResponse({ status: 200, description: 'Serves SyncCord Web App interface' })
  getRoot(@Req() req: Request, @Res() res: Response) {
    const acceptHeader = req.headers['accept'] || '';

    // If browser requests HTML, serve SyncCord Web App
    if (acceptHeader.includes('text/html')) {
      const indexPath = join(process.cwd(), 'public', 'index.html');
      return res.sendFile(indexPath);
    }

    // Otherwise return API service status and links
    return res.status(HttpStatus.OK).json({
      name: 'SyncCord API & Web Client',
      version: '10.0.0',
      status: 'online',
      webApp: '/',
      documentation: '/api/docs',
      apiPrefix: '/api/v10',
      gateway: {
        protocol: 'WebSocket',
        path: '/',
      },
    });
  }

  @Get('app')
  @ApiOperation({ summary: 'SyncCord Web App SPA' })
  getApp(@Res() res: Response) {
    const indexPath = join(process.cwd(), 'public', 'index.html');
    return res.sendFile(indexPath);
  }

  @Get('download/windows')
  @ApiOperation({ summary: 'Download SyncCord Desktop Installer for Windows' })
  downloadWindows(@Res() res: Response) {
    const installerPath = join(process.cwd(), 'public', 'downloads', 'SyncCordSetup.exe');
    return res.download(installerPath, 'SyncCordSetup.exe');
  }

  @Get('download')
  @ApiOperation({ summary: 'Download SyncCord Desktop Setup' })
  downloadSetup(@Res() res: Response) {
    const installerPath = join(process.cwd(), 'public', 'downloads', 'SyncCordSetup.exe');
    return res.download(installerPath, 'SyncCordSetup.exe');
  }

  @Get('preview')
  @ApiOperation({ summary: 'Extract OpenGraph / rich link preview metadata' })
  @ApiQuery({ name: 'url', required: true, description: 'URL to generate rich preview for' })
  @ApiResponse({ status: 200, description: 'Link preview metadata' })
  async getLinkPreview(@Query('url') targetUrl?: string) {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { success: false, error: 'URL is required' };
    }

    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { success: false, url: targetUrl, error: 'Invalid protocol' };
      }

      // Prevent SSRF / local requests
      const hostname = parsedUrl.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.endsWith('.local') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.') ||
        hostname.startsWith('169.254.')
      ) {
        return { success: false, url: targetUrl, error: 'Private hostnames cannot be previewed' };
      }

      // Check if direct image link
      if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(parsedUrl.pathname)) {
        return {
          success: true,
          url: targetUrl,
          title: parsedUrl.pathname.split('/').pop() || 'Imagem',
          image: targetUrl,
          siteName: parsedUrl.hostname,
          mediaType: 'image',
        };
      }

      // Fetch with timeout
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SyncCordBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return { success: false, url: targetUrl, status: response.status };
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        return {
          success: true,
          url: targetUrl,
          title: parsedUrl.pathname.split('/').pop() || 'Imagem',
          image: targetUrl,
          siteName: parsedUrl.hostname,
          mediaType: 'image',
        };
      }

      const text = await response.text();
      const headChunk = text.slice(0, 300000);

      const getMeta = (prop: string) => {
        const patterns = [
          new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
          new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
        ];
        for (const re of patterns) {
          const match = headChunk.match(re);
          if (match && match[1]) return match[1].trim();
        }
        return undefined;
      };

      const titleMatch = headChunk.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = getMeta('og:title') || getMeta('twitter:title') || (titleMatch ? titleMatch[1].trim() : parsedUrl.hostname);
      const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
      let image = getMeta('og:image') || getMeta('twitter:image');
      const siteName = getMeta('og:site_name') || parsedUrl.hostname;
      const themeColor = getMeta('theme-color');

      if (image && !image.startsWith('http')) {
        try {
          image = new URL(image, targetUrl).href;
        } catch {}
      }

      return {
        success: true,
        url: targetUrl,
        title,
        description,
        image,
        siteName,
        themeColor,
      };
    } catch (e: any) {
      return {
        success: false,
        url: targetUrl,
        error: e?.message || 'Failed to fetch preview',
      };
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Healthcheck endpoint' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
