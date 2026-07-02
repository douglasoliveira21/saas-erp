import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Route } from './entities/route.entity';
import { RouteLeg } from './entities/route-leg.entity';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
    @InjectRepository(RouteLeg)
    private legsRepository: Repository<RouteLeg>,
    private dataSource: DataSource,
    private vehiclesService: VehiclesService,
  ) {}

  async create(dto: any): Promise<Route> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const legs: { origin: string; destination: string; km: number }[] = dto.legs || [];
      if (legs.length === 0) throw new BadRequestException('Adicione pelo menos um trecho');

      // Se tem veículo, busca o rate_per_km do veículo
      let ratePerKm = Number(dto.ratePerKm || 1.30);
      let vehicleId = dto.vehicleId || null;

      if (vehicleId) {
        const vehicle = await this.vehiclesService.findOne(vehicleId);
        ratePerKm = Number(vehicle.ratePerKm);
      }

      const totalKm = legs.reduce((s, l) => s + Number(l.km), 0);
      const totalValue = totalKm * ratePerKm;

      // Origem e destino resumidos (primeiro e último trecho)
      const origin = legs[0].origin;
      const destination = legs[legs.length - 1].destination;

      const route = queryRunner.manager.create(Route, {
        technicianId: dto.technicianId,
        vehicleId,
        description: dto.description,
        origin,
        destination,
        km: totalKm,
        ratePerKm,
        totalValue,
        observations: dto.observations,
        routeDate: dto.routeDate || new Date().toISOString().split('T')[0],
      });

      const savedRoute = await queryRunner.manager.save(Route, route);

      // Salvar trechos
      for (let i = 0; i < legs.length; i++) {
        const leg = queryRunner.manager.create(RouteLeg, {
          routeId: savedRoute.id,
          origin: legs[i].origin,
          destination: legs[i].destination,
          km: Number(legs[i].km),
          sortOrder: i,
        });
        await queryRunner.manager.save(RouteLeg, leg);
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedRoute.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Route[]> {
    return this.routesRepository.find({
      relations: ['technician', 'vehicle', 'legs'],
      order: { routeDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Route> {
    const route = await this.routesRepository.findOne({
      where: { id },
      relations: ['technician', 'vehicle', 'legs'],
    });
    if (!route) throw new NotFoundException('Rota não encontrada');
    // Ordenar legs
    if (route.legs) route.legs.sort((a, b) => a.sortOrder - b.sortOrder);
    return route;
  }

  async approve(id: string, userId: string): Promise<Route> {
    const route = await this.findOne(id);
    if (!['pendente', 'aprovado'].includes(route.status)) throw new BadRequestException('Esta rota nao pode ser paga');
    route.status = 'pago';
    route.paidBy = userId;
    route.paidAt = new Date();
    return this.routesRepository.save(route);
  }

  async pay(id: string, userId: string): Promise<Route> {
    const route = await this.findOne(id);
    if (!['pendente', 'aprovado'].includes(route.status)) throw new BadRequestException('Esta rota nao pode ser paga');
    route.status = 'pago';
    route.paidBy = userId;
    route.paidAt = new Date();
    return this.routesRepository.save(route);
  }

  async cancel(id: string): Promise<Route> {
    const route = await this.findOne(id);
    if (['pago', 'cancelado'].includes(route.status)) throw new BadRequestException('Esta rota não pode ser cancelada');
    route.status = 'cancelado';
    return this.routesRepository.save(route);
  }

  async remove(id: string): Promise<void> {
    const route = await this.findOne(id);
    if (!['pendente', 'cancelado'].includes(route.status)) throw new BadRequestException('Apenas rotas pendentes ou canceladas podem ser removidas');
    await this.dataSource.query('DELETE FROM route_legs WHERE route_id = $1', [id]);
    await this.routesRepository.remove(route);
  }

  async update(id: string, dto: any, userId: string): Promise<Route> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const route = await this.findOne(id);

      if (route.technicianId !== userId) {
        throw new BadRequestException('Você só pode editar suas próprias rotas');
      }
      if (route.status !== 'pendente') {
        throw new BadRequestException('Apenas rotas pendentes podem ser editadas');
      }

      const legs: { origin: string; destination: string; km: number }[] = dto.legs || [];
      if (legs.length === 0) throw new BadRequestException('Adicione pelo menos um trecho');

      const ratePerKm = Number(route.ratePerKm); // mantém a taxa original
      const totalKm = legs.reduce((s, l) => s + Number(l.km), 0);
      const totalValue = totalKm * ratePerKm;
      const origin = legs[0].origin;
      const destination = legs[legs.length - 1].destination;

      // Atualizar rota
      await queryRunner.manager.update(Route, id, {
        description: dto.description,
        routeDate: dto.routeDate,
        observations: dto.observations,
        origin,
        destination,
        km: totalKm,
        totalValue,
      });

      // Remover legs antigos e recriar
      await queryRunner.manager.delete(RouteLeg, { routeId: id });

      for (let i = 0; i < legs.length; i++) {
        const leg = queryRunner.manager.create(RouteLeg, {
          routeId: id,
          origin: legs[i].origin,
          destination: legs[i].destination,
          km: Number(legs[i].km),
          sortOrder: i,
        });
        await queryRunner.manager.save(RouteLeg, leg);
      }

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
  async getSummary(technicianId?: string) {
    const qb = this.routesRepository.createQueryBuilder('route');
    if (technicianId) qb.where('route.technician_id = :technicianId', { technicianId });
    const all = await qb.getMany();
    return {
      totalKm: all.reduce((s, r) => s + Number(r.km), 0),
      totalValue: all.reduce((s, r) => s + Number(r.totalValue), 0),
      pendente: all.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.totalValue), 0),
      aprovado: all.filter(r => r.status === 'aprovado').reduce((s, r) => s + Number(r.totalValue), 0),
      pago: all.filter(r => r.status === 'pago').reduce((s, r) => s + Number(r.totalValue), 0),
      count: all.length,
    };
  }

  async payAllApprovedByMonth(year: number, month: number, userId: string): Promise<{ count: number; total: number }> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];

    const routes = await this.routesRepository
      .createQueryBuilder('route')
      .where('route.status IN (:...statuses)', { statuses: ['pendente', 'aprovado'] })
      .andWhere('route.route_date >= :start', { start })
      .andWhere('route.route_date <= :end', { end })
      .getMany();

    if (routes.length === 0) return { count: 0, total: 0 };

    const total = routes.reduce((s, r) => s + Number(r.totalValue), 0);

    await this.routesRepository
      .createQueryBuilder()
      .update(Route)
      .set({ status: 'pago', paidBy: userId, paidAt: new Date() })
      .where('id IN (:...ids)', { ids: routes.map(r => r.id) })
      .execute();

    return { count: routes.length, total };
  }

  async approveAllPendingByMonth(year: number, month: number, userId: string): Promise<{ count: number; total: number }> {
    // Agora approveMonth tambem paga direto
    return this.payAllApprovedByMonth(year, month, userId);
  }
}
