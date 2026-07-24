import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from './entities/opportunity.entity';
@Injectable()
export class CrmService {
 constructor(@InjectRepository(Opportunity) private repo:Repository<Opportunity>) {}
 findAll(stage?:string,customerId?:string){const where:any={};if(stage)where.stage=stage;if(customerId)where.customerId=customerId;return this.repo.find({where,relations:['customer','owner'],order:{expectedCloseDate:'ASC',createdAt:'DESC'}})}
 async findOne(id:string){const item=await this.repo.findOne({where:{id},relations:['customer','owner']});if(!item)throw new NotFoundException('Oportunidade não encontrada');return item}
 create(dto:any,userId:string){return this.repo.save(this.repo.create({...dto,ownerId:dto.ownerId||userId}))}
 async update(id:string,dto:any){const item=await this.findOne(id);if(dto.stage==='perdido'&&!dto.lostReason&&!item.lostReason)throw new BadRequestException('Informe o motivo da perda');Object.assign(item,dto);return this.repo.save(item)}
 async remove(id:string){await this.repo.delete(id);return {success:true}}
 async summary(){const rows=await this.repo.createQueryBuilder('o').select('o.stage','stage').addSelect('COUNT(*)::int','count').addSelect('COALESCE(SUM(o.value),0)','value').addSelect('COALESCE(SUM(o.value*o.probability/100),0)','weightedValue').groupBy('o.stage').getRawMany();return {stages:rows,totalForecast:rows.filter(x=>!['ganho','perdido'].includes(x.stage)).reduce((a,x)=>a+Number(x.weightedValue),0)}}
}
