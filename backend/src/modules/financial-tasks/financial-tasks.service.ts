import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialTask } from './entities/financial-task.entity';

@Injectable()
export class FinancialTasksService {
  constructor(
    @InjectRepository(FinancialTask)
    private tasksRepository: Repository<FinancialTask>,
  ) {}

  async findAll(): Promise<FinancialTask[]> {
    return this.tasksRepository.find({
      relations: ['sale', 'sale.customer', 'sale.technician'],
      order: { dueDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async findPending(): Promise<FinancialTask[]> {
    return this.tasksRepository.find({
      where: { status: 'pendente' },
      relations: ['sale', 'sale.customer', 'sale.technician'],
      order: { dueDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async complete(id: string, userId: string, observations?: string): Promise<FinancialTask> {
    const task = await this.tasksRepository.findOne({ where: { id }, relations: ['sale', 'sale.customer'] });
    if (!task) throw new NotFoundException('Tarefa nao encontrada');
    task.status = 'concluido';
    task.completedBy = userId;
    task.completedAt = new Date();
    if (observations) task.observations = observations;
    return this.tasksRepository.save(task);
  }

  async createForSale(saleId: string, paymentMethod: string, dueDate?: string): Promise<void> {
    // Sempre criar pendencia de NF
    const nfTask = this.tasksRepository.create({
      saleId,
      type: 'emissao_nf',
      dueDate: dueDate || new Date().toISOString().split('T')[0],
    });
    await this.tasksRepository.save(nfTask);

    // Se for boleto, criar pendencia de emissao de boleto
    if (paymentMethod === 'boleto') {
      const boletoTask = this.tasksRepository.create({
        saleId,
        type: 'emissao_boleto',
        dueDate: dueDate || new Date().toISOString().split('T')[0],
      });
      await this.tasksRepository.save(boletoTask);
    }
  }

  async getTodayTasks(): Promise<{ nf: FinancialTask[]; boleto: FinancialTask[]; overdue: FinancialTask[] }> {
    const today = new Date().toISOString().split('T')[0];
    const pending = await this.findPending();

    return {
      nf: pending.filter(t => t.type === 'emissao_nf' && t.dueDate === today),
      boleto: pending.filter(t => t.type === 'emissao_boleto' && t.dueDate === today),
      overdue: pending.filter(t => t.dueDate && t.dueDate < today),
    };
  }
}
