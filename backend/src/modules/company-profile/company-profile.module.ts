import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyProfile } from './entities/company-profile.entity';
import { CompanyProfileService } from './company-profile.service';
import { CompanyProfileController } from './company-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyProfile])],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}
