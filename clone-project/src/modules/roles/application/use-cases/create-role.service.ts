import { Injectable, Inject } from '@nestjs/common';
import { Role } from '../../domain/entities/role.entity';
import { CreateRoleCommand, CreateRoleUseCase } from '../ports/in/create-role.use-case';
import { RoleRepositoryPort, ROLE_REPOSITORY_PORT } from '../ports/out/role-repository.port';
import { Snowflake } from '@shared/snowflake/snowflake';

@Injectable()
export class CreateRoleService implements CreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roleRepository: RoleRepositoryPort,
  ) {}

  async execute(command: CreateRoleCommand): Promise<Role> {
    const id = Snowflake.generate();
    const role = new Role(
      id,
      command.guildId,
      command.name.trim(),
      command.color ?? 0,
      command.hoist ?? false,
      command.position ?? 0,
      command.permissions ?? '0',
      false,
      command.mentionable ?? false,
      new Date(),
    );

    return this.roleRepository.create(role);
  }
}
