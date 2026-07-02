import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
  ) {}

  async create(dto: any): Promise<Contract> {
    const contract = this.contractsRepository.create(dto);
    const saved = await this.contractsRepository.save(contract);
    return this.findOne((Array.isArray(saved) ? saved[0] : saved).id);
  }

  async findAll(): Promise<Contract[]> {
    return this.contractsRepository.find({
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Contract> {
    const contract = await this.contractsRepository.findOne({
      where: { id },
      relations: ['customer'],
    });
    if (!contract) throw new NotFoundException('Contrato nao encontrado');
    return contract;
  }

  async update(id: string, dto: any): Promise<Contract> {
    const contract = await this.findOne(id);
    Object.assign(contract, dto);
    return this.contractsRepository.save(contract);
  }

  async remove(id: string): Promise<void> {
    const contract = await this.findOne(id);
    await this.contractsRepository.remove(contract);
  }

  async findByCustomer(customerId: string): Promise<Contract[]> {
    return this.contractsRepository.find({
      where: { customerId },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
  }
}
