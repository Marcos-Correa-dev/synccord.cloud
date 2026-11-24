import { RefreshTokenService } from './refresh-token.service';
import { UserRepositoryPort } from '../ports/out/user-repository.port';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../domain/user.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      updatePassword: jest.fn(),
      markUserVerified: jest.fn(),
      createPasswordResetToken: jest.fn(),
      findPasswordResetToken: jest.fn(),
      markPasswordResetTokenUsed: jest.fn(),
      createEmailVerificationToken: jest.fn(),
      findEmailVerificationToken: jest.fn(),
      markEmailVerificationTokenUsed: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('new.jwt.token'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new RefreshTokenService(mockUserRepo, mockJwtService);
  });

  it('should successfully refresh access token and refresh token', async () => {
    const existingUser = new User('1001', 'marcos', '0001', 'marcos@example.com', 'hash');
    mockJwtService.verify.mockReturnValue({ sub: '1001', type: 'refresh' });
    mockUserRepo.findById.mockResolvedValue(existingUser);

    const result = await service.execute({ refreshToken: 'valid.refresh.token' });

    expect(result).toBeDefined();
    expect(result.token).toBe('new.jwt.token');
    expect(result.refreshToken).toBe('new.jwt.token');
    expect(result.user.id).toBe('1001');
    expect(mockJwtService.verify).toHaveBeenCalledWith('valid.refresh.token');
    expect(mockUserRepo.findById).toHaveBeenCalledWith('1001');
  });

  it('should throw UnauthorizedException if refreshToken is missing', async () => {
    await expect(service.execute({ refreshToken: '' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if token verification fails', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(service.execute({ refreshToken: 'expired.token' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if token is not of type refresh', async () => {
    mockJwtService.verify.mockReturnValue({ sub: '1001', type: 'access' });

    await expect(service.execute({ refreshToken: 'access.token' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user no longer exists', async () => {
    mockJwtService.verify.mockReturnValue({ sub: '9999', type: 'refresh' });
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(service.execute({ refreshToken: 'valid.token' })).rejects.toThrow(UnauthorizedException);
  });
});
