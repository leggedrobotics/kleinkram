import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { ProjectWithCreator } from './project-with-creator.dto';

export class ProjectWithMissionCountDto extends ProjectWithCreator {
    @ApiProperty()
    @IsNumber()
    missionCount!: number;
}
