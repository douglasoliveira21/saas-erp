import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyProfile } from './entities/company-profile.entity';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

const MAX_LOGO_BASE64_LENGTH = 700_000; // ~500KB de imagem (base64 infla ~33%)

@Injectable()
export class CompanyProfileService {
  constructor(
    @InjectRepository(CompanyProfile) private repo: Repository<CompanyProfile>,
  ) {}

  async getForTenant(tenantId: string): Promise<CompanyProfile | null> {
    return this.repo.findOne({ where: { tenantId } });
  }

  async upsert(tenantId: string, dto: UpdateCompanyProfileDto): Promise<CompanyProfile> {
    if (dto.logo && !/^data:image\/(?:png|jpe?g);base64,/i.test(dto.logo)) {
      throw new BadRequestException('Logo deve ser uma imagem PNG ou JPG.');
    }
    if (dto.logo && dto.logo.length > MAX_LOGO_BASE64_LENGTH) {
      throw new BadRequestException('Imagem muito grande. Máximo 500KB.');
    }
    let profile = await this.repo.findOne({ where: { tenantId } });
    if (!profile) profile = this.repo.create({ tenantId });
    Object.assign(profile, dto);
    return this.repo.save(profile);
  }
}
