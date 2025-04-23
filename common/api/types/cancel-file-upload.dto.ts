import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsUUID } from 'class-validator';

export class CancelFileUploadDto {
    @ApiProperty()
    @IsArray()
    @IsString({ each: true })
    uuids!: string[];

    @IsUUID()
    missionUuid!: string;
}
