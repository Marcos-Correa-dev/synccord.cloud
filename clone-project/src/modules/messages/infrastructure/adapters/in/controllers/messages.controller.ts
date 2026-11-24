import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Inject,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { CreateMessageDto } from '../dtos/create-message.dto';
import { UpdateMessageDto } from '../dtos/update-message.dto';
import { MessageResponseDto } from '../dtos/message-response.dto';
import { SendMessageUseCase, SEND_MESSAGE_USE_CASE } from '@modules/messages/application/ports/in/send-message.use-case';
import { ListChannelMessagesUseCase, LIST_CHANNEL_MESSAGES_USE_CASE } from '@modules/messages/application/ports/in/list-channel-messages.use-case';
import { MessageRepositoryPort, MESSAGE_REPOSITORY_PORT } from '@modules/messages/application/ports/out/message-repository.port';
import { MessageEventPublisherPort, MESSAGE_EVENT_PUBLISHER_PORT } from '@modules/messages/application/ports/out/message-event-publisher.port';
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
    @Inject(MESSAGE_REPOSITORY_PORT)
    private readonly messageRepo: MessageRepositoryPort,
    @Inject(MESSAGE_EVENT_PUBLISHER_PORT)
    private readonly eventPublisher: MessageEventPublisherPort,
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

  @Patch(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a message in a channel' })
  @ApiParam({ name: 'channelId', description: 'Snowflake ID of the channel' })
  @ApiParam({ name: 'messageId', description: 'Snowflake ID of the message' })
  @ApiResponse({ status: 200, description: 'Message edited successfully', type: MessageResponseDto })
  async editMessage(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
    @Request() req: { user: User },
  ): Promise<MessageResponseDto> {
    const existing = await this.messageRepo.findById(messageId);
    if (!existing || existing.channelId !== channelId) {
      throw new NotFoundException('Mensagem não encontrada.');
    }
    if (existing.authorId !== req.user.id) {
      throw new ForbiddenException('Você só pode editar suas próprias mensagens.');
    }

    const updated = await this.messageRepo.updateContent(messageId, dto.content.trim());
    if (this.eventPublisher.publishMessageUpdated) {
      await this.eventPublisher.publishMessageUpdated(updated);
    }
    return updated;
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a message from a channel' })
  @ApiParam({ name: 'channelId', description: 'Snowflake ID of the channel' })
  @ApiParam({ name: 'messageId', description: 'Snowflake ID of the message' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  async deleteMessage(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Request() req: { user: User },
  ): Promise<{ deleted: boolean; id: string }> {
    const existing = await this.messageRepo.findById(messageId);
    if (!existing || existing.channelId !== channelId) {
      throw new NotFoundException('Mensagem não encontrada.');
    }
    if (existing.authorId !== req.user.id) {
      throw new ForbiddenException('Você só pode excluir suas próprias mensagens.');
    }

    await this.messageRepo.delete(messageId);
    if (this.eventPublisher.publishMessageDeleted) {
      await this.eventPublisher.publishMessageDeleted(channelId, messageId);
    }
    return { deleted: true, id: messageId };
  }
}
