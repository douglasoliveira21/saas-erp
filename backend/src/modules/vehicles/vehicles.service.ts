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

    // Usa a API pública brasileira de consulta de placas
    try {
      const data = await this.fetchPlateData(normalized);
      return data;
    } catch (error) {
      // Se a API falhar, retorna apenas a placa normalizada
      return {
        plate: normalized,
        brand: null,
        model: null,
        color: null,
        year: null,
        yearModel: null,
        fuel: null,
        message: 'Não foi possível consultar os dados da placa. Preencha manualmente.',
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
        hostname: 'wdapi2.com.br',
        port: 443,
        path: '/consulta/' + plate + '/json',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.MARCA) {
              resolve({
                plate,
                brand: json.MARCA || null,
                model: json.MODELO || null,
                color: json.cor || json.COR || null,
                year: json.ano ? parseInt(json.ano) : null,
                yearModel: json.anoModelo ? parseInt(json.anoModelo) : null,
                fuel: json.combustivel || null,
              });
            } else {
              reject(new Error('Placa não encontrada'));
            }
          } catch {
            reject(new Error('Erro ao parsear resposta'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }
}
