import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'requireModule';

// Chave de módulo deve bater com uma das definidas em
// frontend/src/data/planModules.ts (mesmo catálogo usado na tela de planos do super admin).
export const RequireModule = (moduleKey: string) => SetMetadata(REQUIRE_MODULE_KEY, moduleKey);
