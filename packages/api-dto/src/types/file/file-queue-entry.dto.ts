import { MissionDto } from '@api-dto/mission/mission.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { FileLocation, QueueState } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

export class FileQueueEntryDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    identifier!: string;

    @ApiProperty()
    @IsString()
    display_name!: string;

    @ApiProperty()
    @IsEnum(FileLocation)
    location!: FileLocation;

    @ApiProperty()
    @IsNumber()
    processingDuration!: number;

    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;

    @ApiProperty()
    @IsEnum(QueueState)
    state!: QueueState;

    @ApiProperty()
    @ValidateNested()
    @Type(() => MissionDto)
    mission!: MissionDto;
}
