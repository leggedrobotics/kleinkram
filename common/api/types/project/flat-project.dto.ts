import { BaseProjectDto } from './base-project.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class FlatProjectDto extends BaseProjectDto {
    @ApiProperty()
    @IsNumber()
    missionCount!: number;
}