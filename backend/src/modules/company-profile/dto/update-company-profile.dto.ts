import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  inscricaoEstadual?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  inscricaoMunicipal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endereco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}
