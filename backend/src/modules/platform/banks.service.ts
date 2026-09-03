import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from './entities/bank.entity';

@Injectable()
export class BanksService {
  constructor(
    @InjectRepository(Bank) private readonly repo: Repository<Bank>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const bank = await this.repo.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Banco não encontrado');
    return bank;
  }

  create(dto: Partial<Bank>) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<Bank>) {
    const bank = await this.findOne(id);
    Object.assign(bank, dto);
    return this.repo.save(bank);
  }

  async remove(id: string) {
    const bank = await this.findOne(id);
    await this.repo.remove(bank);
    return { success: true };
  }
}
