import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MunicipalitiesService } from './municipalities.service';
import { BanksService } from './banks.service';

// Leitura dos catálogos de plataforma (municípios/bancos) para qualquer tenant autenticado —
// dado de referência, não é controlado por plano nem exige role de admin.
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(
    private readonly municipalitiesService: MunicipalitiesService,
    private readonly banksService: BanksService,
  ) {}

  @Get('municipalities')
  findAllMunicipalities() {
    return this.municipalitiesService.findAll();
  }

  @Get('municipalities/:ibgeCode')
  async findMunicipality(@Param('ibgeCode') ibgeCode: string) {
    const municipality = await this.municipalitiesService.findByIbgeCode(ibgeCode);
    return municipality || { found: false };
  }

  @Get('banks')
  findAllBanks() {
    return this.banksService.findAll();
  }
}
