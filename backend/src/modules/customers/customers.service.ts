import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { getCustomerEmails } from '../../common/customer-emails';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    private dataSource: DataSource,
  ) {}

  async create(createCustomerDto: any): Promise<Customer> {
    const email = String(createCustomerDto.email || '').trim().toLowerCase() || null;
    createCustomerDto.email = email;
    createCustomerDto.additionalEmails = getCustomerEmails({ email, additionalEmails: createCustomerDto.additionalEmails }).filter(item => item !== email);
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

  async getHistory(id: string) {
    const customer = await this.findOne(id);
    const queries: Record<string,string> = {
      sales: "SELECT id,total_amount,status,payment_status,created_at FROM sales WHERE customer_id=$1 AND archived_at IS NULL ORDER BY created_at DESC LIMIT 100",
      contracts: "SELECT id,title,status,monthly_value,start_date,end_date,equipments FROM contracts WHERE customer_id=$1 AND archived_at IS NULL ORDER BY created_at DESC",
      tickets: "SELECT id,glpi_id,name,status,date_opened,date_solved,action_time FROM glpi_tickets WHERE customer_id=$1 ORDER BY date_opened DESC LIMIT 200",
      invoices: "SELECT i.id,i.number,i.status,i.total_value,i.created_at FROM invoices i JOIN sales s ON s.id=i.sale_id WHERE s.customer_id=$1 ORDER BY i.created_at DESC LIMIT 100",
      receivables: "SELECT id,description,total_value,paid_value,pending_value,status,due_date,paid_at FROM accounts_receivable WHERE customer_id=$1 ORDER BY due_date DESC LIMIT 100",
      opportunities: "SELECT id,title,stage,value,probability,expected_close_date,lost_reason FROM crm_opportunities WHERE customer_id=$1 ORDER BY created_at DESC",
    };
    const result:any={customer};
    await Promise.all(Object.entries(queries).map(async ([key,sql])=>{try{result[key]=await this.dataSource.query(sql,[id])}catch{result[key]=[]}}));
    result.pending={receivables:result.receivables.filter((x:any)=>!['pago','cancelado'].includes(x.status)),opportunities:result.opportunities.filter((x:any)=>!['ganho','perdido'].includes(x.stage))};
    result.sla={tickets:result.tickets.length,totalHours:result.tickets.reduce((a:number,x:any)=>a+Number(x.action_time||0)/3600,0)};
    return result;
  }

  async update(id: string, updateCustomerDto: any): Promise<Customer> {
    const customer = await this.findOne(id);
    const email = String(updateCustomerDto.email ?? customer.email ?? '').trim().toLowerCase() || null;
    updateCustomerDto.email = email;
    updateCustomerDto.additionalEmails = getCustomerEmails({ email, additionalEmails: updateCustomerDto.additionalEmails ?? customer.additionalEmails }).filter(item => item !== email);
    Object.assign(customer, updateCustomerDto);
    return this.customersRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.softRemove(customer);
  }
}
