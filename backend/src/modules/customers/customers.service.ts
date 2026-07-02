import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: any): Promise<Customer> {
    const customer = this.customersRepository.create(createCustomerDto);
    const saved = await this.customersRepository.save(customer);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async findAll(): Promise<Customer[]> {
    return this.customersRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({ where: { id } });
    
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    
    return customer;
  }

  async update(id: string, updateCustomerDto: any): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, updateCustomerDto);
    return this.customersRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.remove(customer);
  }
}
