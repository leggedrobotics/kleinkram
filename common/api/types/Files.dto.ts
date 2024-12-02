import { ApiProperty } from '@nestjs/swagger';
import { FlatMissionDto } from './Mission.dto';
import { CategoriesDto } from './Category.dto';
import { FileState } from '../../frontend_shared/enum';
import { UserDto } from './User.dto';

export class FileDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    filename!: string;

    @ApiProperty()
    date!: Date;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    mission!: FlatMissionDto;

    @ApiProperty()
    categories!: CategoriesDto;

    @ApiProperty()
    size!: number;

    @ApiProperty()
    state!: FileState;

    @ApiProperty()
    creator!: UserDto;

    @ApiProperty()
    uploaded?: number;

    @ApiProperty()
    canceled?: boolean;

    @ApiProperty()
    missionUuid?: string;

    @ApiProperty()
    hash!: string;
}

export class FilesDto {
    @ApiProperty()
    count!: number;

    @ApiProperty()
    files!: FileDto[];
}
