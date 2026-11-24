import { ConflictException } from '@nestjs/common';
import { RegisterService } from './register.service';
import { UserRepositoryPort } from '../ports/out/user-repository.port';
import { User } from '../../domain/user.entity';

describe('RegisterService Unit Tests', () => {
  let service: RegisterService;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockJwtService: any;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn().mockImplementation((user: User) => Promise.resolve(user)),
      updatePassword: jest.fn(),
      markUserVerified: jest.fn(),
      createPasswordResetToken: jest.fn(),
      findPasswordResetToken: jest.fn(),
      markPasswordResetTokenUsed: jest.fn(),
      createEmailVerificationToken: jest.fn().mockResolvedValue(undefined),
      findEmailVerificationToken: jest.fn(),
      markEmailVerificationTokenUsed: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
    };

    service = new RegisterService(mockUserRepo, mockJwtService);
  });

  it('should register a new user with password and generate a JWT', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    const result = await service.execute({
      username: 'marcos',
      email: 'marcos@example.com',
      password: 'StrongPassword123!',
    });

    expect(result).toBeDefined();
    expect(result.user.username).toBe('marcos');
    expect(result.user.email).toBe('marcos@example.com');
    expect(result.token).toBe('mock.jwt.token');
    expect(result.refreshToken).toBeDefined();
    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
  });

  it('should register a new user without password and generate email verification token', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    const result = await service.execute({
      username: 'marcos',
      email: 'marcos@example.com',
    });

    expect(result).toBeDefined();
    expect(result.verificationRequired).toBe(true);
    expect(result.verificationToken).toBeDefined();
    expect(result.user.verified).toBe(false);
    expect(mockUserRepo.createEmailVerificationToken).toHaveBeenCalledTimes(1);
  });

  it('should throw ConflictException if the email already exists and is verified', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(
      new User('123', 'existing', '0001', 'marcos@example.com', 'hash', null, false, true),
    );

    await expect(
      service.execute({
        username: 'marcos',
        email: 'marcos@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow(ConflictException);

    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });
});
