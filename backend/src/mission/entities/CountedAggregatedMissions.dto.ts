import { AggregatedMissionDto } from './AggregatedMission.dto';

export class CountedAggregatedMissionsDto {
    entities: AggregatedMissionDto[];
    count: number;
}
