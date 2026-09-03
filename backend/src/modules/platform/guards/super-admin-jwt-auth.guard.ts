import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SuperAdminJwtAuthGuard extends AuthGuard('jwt-super-admin') {}
