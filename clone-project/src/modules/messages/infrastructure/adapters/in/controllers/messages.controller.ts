import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { CreateMessageDto } from '../dtos/create-message.dto';
import { MessageResponseDto } from '../dtos/message-response.dto';
import { SendMessageUseCase, SEND_MESSAGE_USE_CASE } from '@modules/messages/application/ports/in/send-message.use-case';
import { ListChannelMessagesUseCase, LIST_CHANNEL_MESSAGES_USE_CASE } from '@modules/messages/application/ports/in/list-channel-messages.use-case';
import { User } from '@modules/auth/domain/user.entity';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/messages')
export class MessagesController {
  constructor(
    @Inject(SEND_MESSAGE_USE_CASE)
    private readonly sendMessageUseCase: SendMessageUseCase,
    @Inject(LIST_CHANNEL_MESSAGES_USE_CASE)
    private readonly listChannelMessagesUseCase: ListChannelMessagesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a new message to a channel' })
  @ApiParam({ name: 'channelId', description: 'Snowflake ID of the channel' })
  @ApiResponse({ status: 201, description: 'Message sent successfully', type: MessageResponseDto })
  async sendMessage(
    @Param('channelId') channelId: string,
    @Body() dto: CreateMessageDto,
    @Request() req: { user: User },
  ): Promise<MessageResponseDto> {
    return this.sendMessageUseCase.execute({
      channelId,
      authorId: req.user.id,
      content: dto.content,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List messages in a channel (cursor-based pagination)' })
  @ApiParam({ name: 'channelId', description: 'Snowflake ID of the channel' })
  @ApiQuery({ name: 'limit', required: false, example: 50, description: 'Max messages to return (default 50, max 100)' })
  @ApiQuery({ name: 'before', required: false, example: '133742849204829184', description: 'Get messages before this Snowflake ID' })
  @ApiResponse({ status: 200, description: 'List of messages', type: [MessageResponseDto] })
  async listMessages(
    @Param('channelId') channelId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ): Promise<MessageResponseDto[]> {
    return this.listChannelMessagesUseCase.execute({
      channelId,
      limit: limit ? Number(limit) : undefined,
      beforeId: before,
    });
  }
}
