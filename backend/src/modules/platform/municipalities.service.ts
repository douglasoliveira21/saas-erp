import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Municipality } from './entities/municipality.entity';

@Injectable()
export class MunicipalitiesService {
  constructor(
    @InjectRepository(Municipality) private readonly repo: Repository<Municipality>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findByIbgeCode(ibgeCode: string) {
    return this.repo.findOne({ where: { ibgeCode } });
  }

  async findOne(id: string) {
    const municipality = await this.repo.findOne({ where: { id } });
    if (!municipality) throw new NotFoundException('Município não encontrado');
    return municipality;
  }

  create(dto: Partial<Municipality>) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<Municipality>) {
    const municipality = await this.findOne(id);
    Object.assign(municipality, dto);
    return this.repo.save(municipality);
  }

  async remove(id: string) {
    const municipality = await this.findOne(id);
    await this.repo.remove(municipality);
    return { success: true };
  }
}
