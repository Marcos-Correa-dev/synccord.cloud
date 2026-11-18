import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { VoiceGateway } from './voice.gateway';
import { VoiceController } from './voice.controller';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceGateway],
  exports: [VoiceService],
})
export class VoiceModule {}
