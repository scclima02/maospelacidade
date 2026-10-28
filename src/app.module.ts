import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { DemandasModule } from './demandas/demandas.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { ParticipacoesModule } from './participacoes/participacoes.module';
import { PublicoModule } from './publico/publico.module';
import { VoluntariosModule } from './voluntarios/voluntarios.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    PublicoModule,
    VoluntariosModule,
    NotificacoesModule,
    DemandasModule,
    ParticipacoesModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
