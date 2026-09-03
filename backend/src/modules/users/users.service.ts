import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    // TenantContextService é @Global() (common/tenant/tenant-context.module.ts) — injetamos ele
    // direto, não o PlatformModule/TenantsService, para não criar um ciclo de módulos
    // (PlatformModule já importa UsersModule para provisionar o admin de um tenant novo).
    private tenantContext: TenantContextService,
  ) {}

  // tenantId é opcional: quando omitido, tentamos resolver pelo contexto da requisição atual
  // (admin de um tenant criando outro usuário); se nada resolver, a coluna cai no DEFAULT do
  // banco (o único tenant existente hoje). O provisionamento de um tenant novo (super admin)
  // passa esse valor explicitamente para criar o primeiro admin já no tenant certo.
  async create(createUserDto: CreateUserDto, tenantId?: string): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const resolvedTenantId = tenantId || this.tenantContext.getTenantId();
    if (resolvedTenantId) {
      const [row] = await this.usersRepository.manager.query(
        `SELECT p.limits->>'maxUsers' AS max_users FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id WHERE t.id = $1`,
        [resolvedTenantId],
      );
      const maxUsers = row?.max_users != null ? Number(row.max_users) : null;
      if (maxUsers != null) {
        const count = await this.usersRepository.count({ where: { tenantId: resolvedTenantId } });
        if (count >= maxUsers) throw new BadRequestException(`Limite de usuários do plano atingido (${maxUsers}). Fale com o suporte para aumentar o limite.`);
      }
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
    });

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email já cadastrado');
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.softRemove(user);
  }

  async findTechnicians(): Promise<User[]> {
    return this.usersRepository.find({
      where: { role: UserRole.TECNICO, active: true },
      order: { name: 'ASC' },
    });
  }
}
