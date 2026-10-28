import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller';

@Module({ controllers: [PublicoController] })
export class PublicoModule {}
