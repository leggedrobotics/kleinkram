import { ApiProperty } from '@nestjs/swagger';

export class WorkerDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    identifier!: string;

    @ApiProperty()
    hostname!: string;

    @ApiProperty()
    cpuMemory!: number;

    @ApiProperty()
    gpuModel!: string;

    @ApiProperty()
    gpuMemory!: number;

    @ApiProperty()
    cpuCores!: number;

    @ApiProperty()
    cpuModel!: string;

    @ApiProperty()
    storage!: number;

    @ApiProperty()
    lastSeen!: Date;

    @ApiProperty()
    reachable!: boolean;
}

export class WorkersDto {
    @ApiProperty()
    workers!: WorkerDto[];

    @ApiProperty()
    count!: number;
}
