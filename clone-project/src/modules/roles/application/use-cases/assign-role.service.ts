import { Injectable, Inject } from '@nestjs/common';
import { AssignRoleCommand, AssignRoleUseCase } from '../ports/in/assign-role.use-case';
import { RoleRepositoryPort, ROLE_REPOSITORY_PORT } from '../ports/out/role-repository.port';

@Injectable()
export class AssignRoleService implements AssignRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roleRepository: RoleRepositoryPort,
  ) {}

  async assignRole(command: AssignRoleCommand): Promise<void> {
    await this.roleRepository.addRoleToMember(command.guildId, command.userId, command.roleId);
  }

  async removeRole(command: AssignRoleCommand): Promise<void> {
    await this.roleRepository.removeRoleFromMember(command.guildId, command.userId, command.roleId);
  }
}
