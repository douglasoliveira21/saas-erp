import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import * as https from 'https';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
  ) {}

  async create(dto: any): Promise<Vehicle> {
    const plate = this.normalizePlate(dto.plate);

    const existing = await this.vehiclesRepository.findOne({ where: { plate } });
    if (existing) {
      throw new BadRequestException('Veículo com esta placa já está cadastrado');
    }

    const vehicle = this.vehiclesRepository.create({
      ...dto,
      plate,
      ratePerKm: dto.ratePerKm || 1.30,
    });

    const saved = await this.vehiclesRepository.save(vehicle);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async findAll(): Promise<Vehicle[]> {
    return this.vehiclesRepository.find({
      relations: ['technician'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
      relations: ['technician'],
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado');
    return vehicle;
  }

  async findByTechnician(technicianId: string): Promise<Vehicle[]> {
    if (!technicianId) return [];
    return this.vehiclesRepository.find({
      where: { technicianId, active: true },
      relations: ['technician'],
    });
  }

  async update(id: string, dto: any): Promise<Vehicle> {
    const vehicle = await this.findOne(id);

    if (dto.plate) {
      dto.plate = this.normalizePlate(dto.plate);
      if (dto.plate !== vehicle.plate) {
        const existing = await this.vehiclesRepository.findOne({ where: { plate: dto.plate } });
        if (existing) throw new BadRequestException('Já existe veículo com esta placa');
      }
    }

    Object.assign(vehicle, dto);
    return this.vehiclesRepository.save(vehicle);
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    await this.vehiclesRepository.remove(vehicle);
  }

  async searchPlate(plate: string): Promise<any> {
    const normalized = this.normalizePlate(plate);

    // Tenta buscar dados da placa em APIs públicas
    try {
      const data = await this.fetchPlateData(normalized);
      return data;
    } catch (error) {
      // Se nenhuma API funcionar, retorna dados parciais para preenchimento manual
      return {
        plate: normalized,
        brand: null,
        model: null,
        color: null,
        year: null,
        yearModel: null,
        fuel: null,
        found: false,
        message: 'Consulta automática indisponível. Preencha os dados manualmente.',
      };
    }
  }

  private normalizePlate(plate: string): string {
    return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  private fetchPlateData(plate: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ placa: plate });

      const options = {
        hostname: 'apiplacas.com.br',
        port: 443,
        path: '/consulta/' + plate,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) { reject(new Error('API indisponível')); return; }
            const json = JSON.parse(body);
            // Adapta para diferentes formatos de resposta
            const brand = json.marca || json.MARCA || json.brand || null;
            const model = json.modelo || json.MODELO || json.model || null;

            if (brand || model) {
              resolve({
                plate,
                brand,
                model,
                color: json.cor || json.COR || json.color || null,
                year: json.ano ? parseInt(json.ano) : (json.year ? parseInt(json.year) : null),
                yearModel: json.anoModelo ? parseInt(json.anoModelo) : null,
                fuel: json.combustivel || json.fuel || null,
                found: true,
              });
            } else {
              reject(new Error('Dados não encontrados'));
            }
          } catch {
            reject(new Error('Erro ao processar'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }
}
