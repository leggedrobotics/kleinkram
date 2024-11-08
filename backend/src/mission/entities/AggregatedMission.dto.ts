import Mission from '@common/entities/mission/mission.entity';

export class AggregatedMissionDto extends Mission {
    nrFiles: number;
    size: number;
}
