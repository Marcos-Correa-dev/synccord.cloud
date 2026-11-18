import { Controller, Get, Req, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
