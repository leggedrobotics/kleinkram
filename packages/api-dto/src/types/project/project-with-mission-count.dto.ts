import { ProjectWithCreator } from '@api-dto/project/project-with-creator.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class ProjectWithMissionCountDto extends ProjectWithCreator {
    @ApiProperty()
    @IsNumber()
    missionCount!: number;
}
