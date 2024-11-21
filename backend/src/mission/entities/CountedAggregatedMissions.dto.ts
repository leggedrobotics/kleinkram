import { AggregatedMissionDto } from './AggregatedMission.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CountedAggregatedMissionsDto {
    @ApiProperty()
    entities!: AggregatedMissionDto[];

    @ApiProperty()
    count!: number;
}
