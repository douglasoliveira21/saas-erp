import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;

  // Token do Cloudflare Turnstile resolvido no frontend - opcional aqui de propósito: quando
  // TURNSTILE_SECRET_KEY não está configurado no servidor, o login funciona sem captcha nenhum
  // (dev local, ou antes do super admin configurar a chave em produção).
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
