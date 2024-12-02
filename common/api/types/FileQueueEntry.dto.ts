import { ApiProperty } from '@nestjs/swagger';
import { FileLocation, QueueState } from '../../frontend_shared/enum';
import { UserDto } from './User.dto';
import { FlatMissionDto } from './Mission.dto';

export class FileQueueEntryDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    identifier!: string;

    @ApiProperty()
    displayName!: string;

    @ApiProperty()
    location!: FileLocation;

    @ApiProperty()
    processingDuration!: number;

    @ApiProperty()
    creator!: UserDto;

    @ApiProperty()
    state!: QueueState;

    @ApiProperty()
    mission!: FlatMissionDto;

    @ApiProperty()
    filename!: string;
}

export class FileQueueEntriesDto {
    @ApiProperty()
    entries!: FileQueueEntryDto[];

    @ApiProperty()
    count!: number;
}
