import { SendMessageService } from './send-message.service';
import { MessageRepositoryPort } from '../ports/out/message-repository.port';
import { MessageEventPublisherPort } from '../ports/out/message-event-publisher.port';
import { Message } from '../../domain/entities/message.entity';

describe('SendMessageService Unit Tests', () => {
  let service: SendMessageService;
  let mockMessageRepo: jest.Mocked<MessageRepositoryPort>;
  let mockEventPublisher: jest.Mocked<MessageEventPublisherPort>;

  beforeEach(() => {
    mockMessageRepo = {
      create: jest.fn().mockImplementation((m: Message) => Promise.resolve(m)),
      findById: jest.fn(),
      findByChannelId: jest.fn(),
    };

    mockEventPublisher = {
      publishMessageCreated: jest.fn().mockResolvedValue(undefined),
    };

    service = new SendMessageService(mockMessageRepo, mockEventPublisher);
  });

  it('should save the message and broadcast it via event publisher port', async () => {
    const result = await service.execute({
      channelId: '133742849204829184',
      authorId: '133700000000000001',
      content: 'Hello SyncCord world! 🚀',
    });

    expect(result).toBeDefined();
    expect(result.content).toBe('Hello SyncCord world! 🚀');
    expect(mockMessageRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publishMessageCreated).toHaveBeenCalledWith(result);
  });
});
