import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { SuperAdmin } from './entities/super-admin.entity';
import { Municipality } from './entities/municipality.entity';
import { Bank } from './entities/bank.entity';
import { UsersModule } from '../users/users.module';
import { env } from '../../config/env.config';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SuperAdminJwtStrategy } from './strategies/super-admin-jwt.strategy';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PlanGuard } from './guards/plan.guard';
import { MunicipalitiesService } from './municipalities.service';
import { MunicipalitiesController } from './municipalities.controller';
import { BanksService } from './banks.service';
import { BanksController } from './banks.controller';
import { CatalogsController } from './catalogs.controller';
import { SuperAdminsService } from './super-admins.service';
import { SuperAdminsController } from './super-admins.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Plan, SuperAdmin, Municipality, Bank]),
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: env.platform.superAdminJwtSecret,
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [SuperAdminAuthController, TenantsController, PlansController, MunicipalitiesController, BanksController, CatalogsController, SuperAdminsController],
  providers: [SuperAdminAuthService, SuperAdminJwtStrategy, SuperAdminJwtAuthGuard, TenantsService, PlansService, PlanGuard, MunicipalitiesService, BanksService, SuperAdminsService],
  exports: [TypeOrmModule, TenantsService, PlansService, PlanGuard, MunicipalitiesService, BanksService],
})
export class PlatformModule {}
