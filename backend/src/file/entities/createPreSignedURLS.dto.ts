import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import {
    IsNoValidUUID,
    IsValidFileName,
} from '../../validation/propertyDecorator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePreSignedURLSDto {
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    @IsValidFileName({ each: true })
    @IsNoValidUUID({ each: true })
    @ApiProperty({
        description: 'Filenames for which to generate temporary access',
    })
    filenames: string[];

    @IsUUID()
    @ApiProperty({
        description:
            'UUID of the mission for which to generate temporary access',
    })
    missionUUID: string;
}
