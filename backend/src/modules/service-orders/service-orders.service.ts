import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { ServiceOrder } from './entities/service-order.entity';
import { ServiceOrderStatus } from './entities/service-order-status.entity';
import { ServiceOrderAttachment } from './entities/service-order-attachment.entity';
import { ServiceOrderEvent } from './entities/service-order-event.entity';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ServiceOrderPdfService } from './service-order-pdf.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TenantsService } from '../platform/tenants.service';

const ATTACHMENT_TYPES = ['foto_antes', 'foto_depois', 'documento', 'geral'];

@Injectable()
export class ServiceOrdersService {
  constructor(
    @InjectRepository(ServiceOrder) private ordersRepository: Repository<ServiceOrder>,
    @InjectRepository(ServiceOrderStatus) private statusesRepository: Repository<ServiceOrderStatus>,
    @InjectRepository(ServiceOrderAttachment) private attachmentsRepository: Repository<ServiceOrderAttachment>,
    @InjectRepository(ServiceOrderEvent) private eventsRepository: Repository<ServiceOrderEvent>,
    private whatsappService: WhatsappService,
    private pdfService: ServiceOrderPdfService,
    private tenantContext: TenantContextService,
    private tenantsService: TenantsService,
  ) {}

  // Notificação por WhatsApp nunca pode travar a operação principal da OS — se a instância
  // estiver desconectada, sem número configurado, ou a Evolution API falhar, apenas registramos
  // o erro (o próprio WhatsappService já loga em whatsapp_message_logs) e seguimos em frente.
  private async notifyCustomer(order: ServiceOrder, message: string): Promise<void> {
    try {
      if (!(await this.whatsappService.shouldNotifyServiceOrders())) return;
      const phone = order.customer?.phone;
      if (!phone) return;
      await this.whatsappService.sendText(phone, message, { relatedEntity: 'service_order', relatedId: order.id });
    } catch {
      // já logado pelo WhatsappService; não deve impedir a OS de prosseguir.
    }
  }

  // Mesma notificação de texto, mas anexando o PDF da OS (com a galeria antes/depois) — usado só
  // na conclusão, quando o registro fotográfico já está completo.
  private async notifyCustomerWithPdf(order: ServiceOrder, message: string): Promise<void> {
    try {
      if (!(await this.whatsappService.shouldNotifyServiceOrders())) return;
      const phone = order.customer?.phone;
      if (!phone) return;
      await this.whatsappService.sendText(phone, message, { relatedEntity: 'service_order', relatedId: order.id });
      const pdf = await this.pdfService.generate(order.id);
      await this.whatsappService.sendMedia(
        phone,
        pdf,
        'application/pdf',
        `OS-${String(order.number).padStart(5, '0')}.pdf`,
        '',
        { relatedEntity: 'service_order', relatedId: order.id },
      );
    } catch {
      // já logado pelo WhatsappService; não deve impedir a conclusão da OS.
    }
  }

  // === Status (configurável) ===

  findAllStatuses(includeInactive = false) {
    return this.statusesRepository.find({
      where: includeInactive ? {} : { active: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async createStatus(dto: any) {
    if (!dto.key || !dto.label) throw new BadRequestException('Informe a chave e o nome do status');
    const key = String(dto.key).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) throw new BadRequestException('Chave do status inválida');
    const existing = await this.statusesRepository.findOne({ where: { key } });
    if (existing) throw new BadRequestException('Já existe um status com essa chave');
    const maxOrder = await this.statusesRepository
      .createQueryBuilder('s')
      .select('COALESCE(MAX(s.sortOrder), 0)', 'max')
      .getRawOne();
    const status = this.statusesRepository.create({
      key,
      label: String(dto.label).trim(),
      color: dto.color || '#6b7280',
      sortOrder: Number(maxOrder?.max || 0) + 1,
      isFinal: Boolean(dto.isFinal),
      active: true,
    });
    return this.statusesRepository.save(status);
  }

  async updateStatus(id: string, dto: any) {
    const status = await this.statusesRepository.findOne({ where: { id } });
    if (!status) throw new NotFoundException('Status não encontrado');
    if (dto.label !== undefined) status.label = String(dto.label).trim();
    if (dto.color !== undefined) status.color = dto.color;
    if (dto.sortOrder !== undefined) status.sortOrder = Number(dto.sortOrder);
    if (dto.isFinal !== undefined) status.isFinal = Boolean(dto.isFinal);
    if (dto.active !== undefined) status.active = Boolean(dto.active);
    return this.statusesRepository.save(status);
  }

  async removeStatus(id: string) {
    const status = await this.statusesRepository.findOne({ where: { id } });
    if (!status) throw new NotFoundException('Status não encontrado');
    const inUse = await this.ordersRepository.count({ where: { statusKey: status.key } });
    if (inUse > 0) {
      // Preferimos desativar a excluir: ordens antigas continuam referenciando esta chave de status
      // e não devem ficar com um status "fantasma" que some das telas de configuração.
      status.active = false;
      await this.statusesRepository.save(status);
      return { deactivated: true };
    }
    await this.statusesRepository.remove(status);
    return { deleted: true };
  }

  // === Ordens de serviço ===

  async findAll(filters: { status?: string; customerId?: string; technicianId?: string; search?: string } = {}) {
    const qb = this.ordersRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.technician', 'technician')
      .orderBy('o.createdAt', 'DESC');

    if (filters.status) qb.andWhere('o.statusKey = :status', { status: filters.status });
    if (filters.customerId) qb.andWhere('o.customerId = :customerId', { customerId: filters.customerId });
    if (filters.technicianId) qb.andWhere('o.technicianId = :technicianId', { technicianId: filters.technicianId });
    if (filters.search) {
      qb.andWhere('(customer.name ILIKE :search OR o.serviceType ILIKE :search OR o.customerReport ILIKE :search OR o.equipment ILIKE :search OR CAST(o.number AS TEXT) LIKE :searchNumber)', {
        search: `%${filters.search}%`,
        searchNumber: `%${filters.search}%`,
      });
    }
    return qb.getMany();
  }

  async findOne(id: string): Promise<ServiceOrder> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'technician', 'attachments'],
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');
    return order;
  }

  async create(dto: any, userId?: string): Promise<ServiceOrder> {
    if (!dto.customerId) throw new BadRequestException('Selecione o cliente');
    if (!dto.serviceType) throw new BadRequestException('Informe o tipo de serviço');
    if (!dto.customerReport) throw new BadRequestException('Registre o relato do cliente');

    const statuses = await this.findAllStatuses(true);
    const defaultStatus = statuses.find((s) => s.key === 'iniciando') || statuses[0];
    const statusKey = dto.statusKey && statuses.some((s) => s.key === dto.statusKey) ? dto.statusKey : defaultStatus?.key || 'iniciando';

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) {
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      const monthCount = await this.ordersRepository
        .createQueryBuilder('o')
        .where('o.tenantId = :tenantId', { tenantId })
        .andWhere('o.createdAt >= :startOfMonth', { startOfMonth })
        .getCount();
      await this.tenantsService.assertWithinLimit(tenantId, 'maxServiceOrdersPerMonth', monthCount, 'Limite de ordens de serviço deste mês atingido no plano contratado.');
    }

    const order = this.ordersRepository.create({
      tenantId: tenantId || undefined,
      customerId: dto.customerId,
      technicianId: dto.technicianId || null,
      serviceType: String(dto.serviceType).trim(),
      equipment: dto.equipment ? String(dto.equipment).trim() : null,
      brand: dto.brand ? String(dto.brand).trim() : null,
      model: dto.model ? String(dto.model).trim() : null,
      serialNumber: dto.serialNumber ? String(dto.serialNumber).trim() : null,
      accessories: dto.accessories ? String(dto.accessories).trim() : null,
      customerReport: String(dto.customerReport).trim(),
      diagnosis: dto.diagnosis ? String(dto.diagnosis).trim() : null,
      observations: dto.observations ? String(dto.observations).trim() : null,
      statusKey,
      createdBy: userId,
    });
    const saved = await this.ordersRepository.save(order);
    await this.addEvent(saved.id, 'created', statusKey, 'Ordem de serviço criada', userId);
    const full = await this.findOne(saved.id);
    await this.notifyCustomer(
      full,
      `Olá, ${full.customer?.name || ''}! Sua Ordem de Serviço *#${String(full.number).padStart(5, '0')}* foi aberta.\n\n*Serviço:* ${full.serviceType}\n*Relato:* ${full.customerReport}\n\nVocê receberá atualizações por aqui conforme o andamento.`,
    );
    return full;
  }

  async update(id: string, dto: any, userId?: string): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    const previousStatus = order.statusKey;

    if (dto.customerId !== undefined) order.customerId = dto.customerId;
    if (dto.technicianId !== undefined) order.technicianId = dto.technicianId || null;
    if (dto.serviceType !== undefined) order.serviceType = String(dto.serviceType).trim();
    if (dto.equipment !== undefined) order.equipment = dto.equipment ? String(dto.equipment).trim() : null;
    if (dto.brand !== undefined) order.brand = dto.brand ? String(dto.brand).trim() : null;
    if (dto.model !== undefined) order.model = dto.model ? String(dto.model).trim() : null;
    if (dto.serialNumber !== undefined) order.serialNumber = dto.serialNumber ? String(dto.serialNumber).trim() : null;
    if (dto.accessories !== undefined) order.accessories = dto.accessories ? String(dto.accessories).trim() : null;
    if (dto.customerReport !== undefined) order.customerReport = String(dto.customerReport).trim();
    if (dto.diagnosis !== undefined) order.diagnosis = dto.diagnosis ? String(dto.diagnosis).trim() : null;
    if (dto.observations !== undefined) order.observations = dto.observations ? String(dto.observations).trim() : null;

    if (dto.statusKey !== undefined && dto.statusKey !== previousStatus) {
      const statuses = await this.findAllStatuses(true);
      const target = statuses.find((s) => s.key === dto.statusKey);
      if (!target) throw new BadRequestException('Status inválido');
      order.statusKey = target.key;
      if (!order.startedAt && target.key !== 'iniciando') order.startedAt = new Date();
      if (target.isFinal && !order.completedAt) order.completedAt = new Date();
      if (!target.isFinal) order.completedAt = null;
    }

    const saved = await this.ordersRepository.save(order);
    const statusChanged = dto.statusKey !== undefined && dto.statusKey !== previousStatus;
    if (statusChanged) {
      await this.addEvent(id, 'status_changed', order.statusKey, `Status alterado de "${previousStatus}" para "${order.statusKey}"`, userId);
    } else {
      await this.addEvent(id, 'updated', order.statusKey, 'Ordem de serviço atualizada', userId);
    }
    const full = await this.findOne(saved.id);
    if (statusChanged) {
      const statuses = await this.findAllStatuses(true);
      const label = statuses.find((s) => s.key === order.statusKey)?.label || order.statusKey;
      await this.notifyCustomer(
        full,
        `Atualização da sua Ordem de Serviço *#${String(full.number).padStart(5, '0')}*: agora está em *${label}*.`,
      );
    }
    return full;
  }

  async conclude(id: string, dto: any, userId?: string): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    if (!dto.conclusionDescription) throw new BadRequestException('Descreva o que foi feito na conclusão');
    // Rede de seguranca do lado do servidor (o front ja exige isso antes de habilitar o botao):
    // sem a foto do depois, o comparativo "antes x depois" do PDF enviado ao cliente na conclusao
    // fica incompleto.
    const hasAfterPhoto = (order.attachments || []).some((a) => a.type === 'foto_depois');
    if (!hasAfterPhoto) throw new BadRequestException('Anexe ao menos uma foto do serviço concluído (depois) antes de concluir a OS');

    const statuses = await this.findAllStatuses(true);
    const finalStatus = statuses.find((s) => s.key === 'concluida' && s.isFinal) || statuses.find((s) => s.isFinal);

    order.conclusionDescription = String(dto.conclusionDescription).trim();
    order.partsCost = Number(dto.partsCost || 0);
    order.laborCost = Number(dto.laborCost || 0);
    order.totalCost = Number(order.partsCost) + Number(order.laborCost);
    order.completedAt = new Date();
    if (finalStatus) order.statusKey = finalStatus.key;

    const saved = await this.ordersRepository.save(order);
    await this.addEvent(id, 'completed', order.statusKey, 'Ordem de serviço concluída', userId, {
      partsCost: order.partsCost,
      laborCost: order.laborCost,
      totalCost: order.totalCost,
    });
    const full = await this.findOne(saved.id);
    const totalCost = Number(full.totalCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await this.notifyCustomerWithPdf(
      full,
      `Sua Ordem de Serviço *#${String(full.number).padStart(5, '0')}* foi concluída! ✅\n\n*O que foi feito:* ${full.conclusionDescription}\n*Valor total:* ${totalCost}\n\nSegue em anexo o PDF completo da OS, com as fotos de antes e depois.\n\nObrigado pela confiança!`,
    );
    return full;
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    for (const attachment of order.attachments || []) {
      await unlink(attachment.storagePath).catch(() => {});
    }
    await this.ordersRepository.remove(order);
  }

  async getEvents(id: string) {
    await this.findOne(id);
    return this.eventsRepository.find({ where: { serviceOrderId: id }, order: { createdAt: 'ASC' } });
  }

  private async addEvent(serviceOrderId: string, type: string, statusKey?: string, description?: string, userId?: string, metadata?: any) {
    await this.eventsRepository.save(
      this.eventsRepository.create({ serviceOrderId, type, statusKey, description, createdBy: userId || null, metadata }),
    );
  }

  // === Anexos (fotos e documentos) ===

  async addAttachments(id: string, files: any[], type: string, userId?: string) {
    await this.findOne(id);
    if (!ATTACHMENT_TYPES.includes(type)) throw new BadRequestException('Tipo de anexo inválido');
    const attachments = await Promise.all(
      files.map((file) =>
        this.attachmentsRepository.save(
          this.attachmentsRepository.create({
            serviceOrderId: id,
            type,
            filename: file.originalname,
            mimeType: file.mimetype,
            storagePath: file.path,
            uploadedBy: userId,
          }),
        ),
      ),
    );
    await this.addEvent(id, 'attachment_added', undefined, `${files.length} anexo(s) adicionado(s) (${type})`, userId);
    return attachments;
  }

  async getAttachment(orderId: string, attachmentId: string): Promise<ServiceOrderAttachment> {
    const attachment = await this.attachmentsRepository.findOne({ where: { id: attachmentId, serviceOrderId: orderId } });
    if (!attachment) throw new NotFoundException('Anexo não encontrado');
    return attachment;
  }

  async removeAttachment(orderId: string, attachmentId: string, userId?: string): Promise<void> {
    const attachment = await this.getAttachment(orderId, attachmentId);
    await unlink(attachment.storagePath).catch(() => {});
    await this.attachmentsRepository.remove(attachment);
    await this.addEvent(orderId, 'attachment_removed', undefined, `Anexo removido: ${attachment.filename}`, userId);
  }
}
