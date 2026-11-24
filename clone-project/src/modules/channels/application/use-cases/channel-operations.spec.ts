import { NotFoundException } from '@nestjs/common';
import { UpdateChannelService } from './update-channel.service';
import { DeleteChannelService } from './delete-channel.service';
import { ChannelRepositoryPort } from '../ports/out/channel-repository.port';
import { Channel } from '../../domain/entities/channel.entity';

describe('Channel Update & Delete Use Cases', () => {
  let updateService: UpdateChannelService;
  let deleteService: DeleteChannelService;
  let mockChannelRepo: jest.Mocked<ChannelRepositoryPort>;

  beforeEach(() => {
    mockChannelRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByGuildId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findOrCreateDmChannel: jest.fn(),
      findUserDmChannels: jest.fn(),
      findMutualContacts: jest.fn(),
    };

    updateService = new UpdateChannelService(mockChannelRepo);
    deleteService = new DeleteChannelService(mockChannelRepo);
  });

  it('should format text channel name in lowercase with hyphens on rename', async () => {
    const existingText = new Channel('ch-1', 'g-1', 'geral', 0, null, 0, null);
    mockChannelRepo.findById.mockResolvedValue(existingText);
    mockChannelRepo.update.mockImplementation(async (id, data) =>
      new Channel(id, 'g-1', data.name || 'geral', 0, data.topic ?? null, 0, null),
    );

    const updated = await updateService.execute({
      channelId: 'ch-1',
      name: 'Avisos Importantes',
    });

    expect(updated.name).toBe('avisos-importantes');
    expect(mockChannelRepo.update).toHaveBeenCalledWith('ch-1', {
      name: 'avisos-importantes',
      topic: null,
    });
  });

  it('should preserve casing and spaces on voice channel rename', async () => {
    const existingVoice = new Channel('ch-2', 'g-1', 'Lounge', 2, null, 0, null);
    mockChannelRepo.findById.mockResolvedValue(existingVoice);
    mockChannelRepo.update.mockImplementation(async (id, data) =>
      new Channel(id, 'g-1', data.name || 'Lounge', 2, data.topic ?? null, 0, null),
    );

    const updated = await updateService.execute({
      channelId: 'ch-2',
      name: 'Sala de Reunião VIP',
    });

    expect(updated.name).toBe('Sala de Reunião VIP');
    expect(mockChannelRepo.update).toHaveBeenCalledWith('ch-2', {
      name: 'Sala de Reunião VIP',
      topic: null,
    });
  });

  it('should throw NotFoundException when updating a non-existent channel', async () => {
    mockChannelRepo.findById.mockResolvedValue(null);
    await expect(
      updateService.execute({ channelId: 'missing', name: 'novo' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should delete an existing channel and return confirmation metadata', async () => {
    const existing = new Channel('ch-del', 'g-1', 'temp', 0, null, 0, null);
    mockChannelRepo.findById.mockResolvedValue(existing);
    mockChannelRepo.delete.mockResolvedValue(undefined);

    const result = await deleteService.execute('ch-del');

    expect(result).toEqual({
      deleted: true,
      id: 'ch-del',
      guildId: 'g-1',
    });
    expect(mockChannelRepo.delete).toHaveBeenCalledWith('ch-del');
  });

  it('should throw NotFoundException when deleting a non-existent channel', async () => {
    mockChannelRepo.findById.mockResolvedValue(null);
    await expect(deleteService.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
