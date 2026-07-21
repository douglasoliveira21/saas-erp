import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context.switchToHttp().getRequest();
    if (requiredRoles && !requiredRoles.some((role) => user.role === role)) {
      return false;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || user.role === UserRole.ADMIN) {
      return true;
    }

    const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];
    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }
}
