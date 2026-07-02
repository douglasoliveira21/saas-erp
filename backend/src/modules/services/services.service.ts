import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private servicesRepository: Repository<Service>,
  ) {}

  async create(createServiceDto: any): Promise<Service> {
    const service = this.servicesRepository.create(createServiceDto);
    const saved = await this.servicesRepository.save(service);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async findAll(): Promise<Service[]> {
    return this.servicesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.servicesRepository.findOne({ where: { id } });
    
    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }
    
    return service;
  }

  async update(id: string, updateServiceDto: any): Promise<Service> {
    const service = await this.findOne(id);
    Object.assign(service, updateServiceDto);
    return this.servicesRepository.save(service);
  }

  async remove(id: string): Promise<void> {
    const service = await this.findOne(id);
    await this.servicesRepository.remove(service);
  }
}
