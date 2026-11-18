import { CreateGuildService } from './create-guild.service';
import { GuildRepositoryPort } from '../ports/out/guild-repository.port';
import { Guild } from '../../domain/entities/guild.entity';

describe('CreateGuildService Unit Tests', () => {
  let service: CreateGuildService;
  let mockGuildRepo: jest.Mocked<GuildRepositoryPort>;

  beforeEach(() => {
    mockGuildRepo = {
      create: jest.fn().mockImplementation((guild: Guild) => Promise.resolve(guild)),
      findById: jest.fn(),
      findUserGuilds: jest.fn(),
      addMember: jest.fn().mockResolvedValue(undefined),
      findGuildMembers: jest.fn().mockResolvedValue([]),
      isMember: jest.fn().mockResolvedValue(false),
      createDefaultChannels: jest.fn().mockResolvedValue(undefined),
    };

    service = new CreateGuildService(mockGuildRepo);
  });

  it('should create a guild, add owner as member, and create default channels', async () => {
    const result = await service.execute({
      name: 'Comunidade TypeScript Brasil',
      ownerId: '133700000000000001',
      description: 'Servidor de discussões avançadas de TypeScript',
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('Comunidade TypeScript Brasil');
    expect(result.ownerId).toBe('133700000000000001');
    expect(mockGuildRepo.create).toHaveBeenCalledTimes(1);
    expect(mockGuildRepo.addMember).toHaveBeenCalledTimes(1);
    expect(mockGuildRepo.createDefaultChannels).toHaveBeenCalledTimes(1);
  });
});
