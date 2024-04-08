import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Run from './entities/run.entity';
import { RunService } from './run.service';
import { RunController } from './run.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Run])],
  providers: [RunService],
  controllers: [RunController],
  exports: [RunService],
})
export class RunModule {}
