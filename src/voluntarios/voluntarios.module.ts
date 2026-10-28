import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CadastroController, VoluntariosController } from './voluntarios.controller';
import { VoluntariosService } from './voluntarios.service';

@Module({
  imports: [AuthModule],
  controllers: [CadastroController, VoluntariosController],
  providers: [VoluntariosService],
  exports: [VoluntariosService],
})
export class VoluntariosModule {}
