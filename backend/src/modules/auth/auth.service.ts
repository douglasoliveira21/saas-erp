import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { PasswordReset } from './entities/password-reset.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    @InjectRepository(PasswordReset)
    private resetRepository: Repository<PasswordReset>,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (!user.active) {
      throw new UnauthorizedException('Usuario inativo');
    }

    const payload = { sub: user.id, email: user.email, role: user.role, permissions: user.permissions || [] };

    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions || [] },
    };
  }

  async validateUser(userId: string) {
    return this.usersService.findOne(userId);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Nao revelar se email existe ou nao
      return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' };
    }

    // Gerar token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // expira em 1 hora

    // Salvar token
    const reset = this.resetRepository.create({ userId: user.id, token, expiresAt });
    await this.resetRepository.save(reset);

    // Enviar email
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5001';
    await this.mailService.sendPasswordReset(user.email, user.name, token, baseUrl);

    return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await this.resetRepository.findOne({
      where: { token, used: false },
      relations: ['user'],
    });

    if (!reset) {
      throw new BadRequestException('Token invalido ou expirado');
    }

    if (new Date() > reset.expiresAt) {
      throw new BadRequestException('Token expirado. Solicite um novo link.');
    }

    // Atualizar senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(reset.userId, { password: hashedPassword } as any);

    // Marcar token como usado
    reset.used = true;
    await this.resetRepository.save(reset);

    return { message: 'Senha alterada com sucesso!' };
  }

  async updateProfile(userId: string, dto: { name?: string; email?: string; password?: string; currentPassword?: string }) {
    const user = await this.usersService.findOne(userId);

    // Se quer mudar a senha, precisa da senha atual
    if (dto.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Senha atual e obrigatoria para alterar a senha');
      }
      const isValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isValid) {
        throw new BadRequestException('Senha atual incorreta');
      }
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.email && dto.email !== user.email) updateData.email = dto.email;
    if (dto.password) updateData.password = await bcrypt.hash(dto.password, 10);

    if (Object.keys(updateData).length === 0) {
      return { message: 'Nenhuma alteracao realizada', user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }

    await this.usersService.update(userId, updateData);
    const updated = await this.usersService.findOne(userId);

    return {
      message: 'Perfil atualizado com sucesso!',
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, permissions: updated.permissions || [] },
    };
  }
}
