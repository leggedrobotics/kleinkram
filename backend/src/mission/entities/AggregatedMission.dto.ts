import Mission from '@common/entities/mission/mission.entity';
import { ApiProperty } from '@nestjs/swagger';

export class AggregatedMissionDto extends Mission {
    @ApiProperty()
    nrFiles!: number;

    @ApiProperty()
    size!: number;
}
