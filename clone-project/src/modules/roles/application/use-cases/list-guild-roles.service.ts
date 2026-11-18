import { Injectable, Inject } from '@nestjs/common';
import { Role } from '../../domain/entities/role.entity';
import { ListGuildRolesUseCase } from '../ports/in/list-guild-roles.use-case';
import { RoleRepositoryPort, ROLE_REPOSITORY_PORT } from '../ports/out/role-repository.port';

@Injectable()
export class ListGuildRolesService implements ListGuildRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roleRepository: RoleRepositoryPort,
  ) {}

  async execute(guildId: string): Promise<Role[]> {
    return this.roleRepository.findByGuildId(guildId);
  }
}
