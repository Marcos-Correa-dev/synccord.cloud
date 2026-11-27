import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '@modules/auth/auth.module';
import { ConnectionsController } from './infrastructure/adapters/in/controllers/connections.controller';
import { DrizzleConnectionRepository } from './infrastructure/adapters/out/drizzle-connection.repository';
import { OAuthProviderService } from './application/oauth-provider.service';
import { PublicProfileLookupService } from './application/public-profile-lookup.service';

@Module({
  imports: [
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'discord-clone-super-secret-jwt-key-dev',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [ConnectionsController],
  providers: [
    DrizzleConnectionRepository,
    PublicProfileLookupService,
    OAuthProviderService,
  ],
  exports: [DrizzleConnectionRepository],
})
export class ConnectionsModule {}
