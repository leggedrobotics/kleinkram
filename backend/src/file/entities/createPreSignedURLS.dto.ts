import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IsValidFileName } from '../../validation/propertyDecorator';

export class CreatePreSignedURLSDto {
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    @IsValidFileName({ each: true })
    filenames: string[];

    @IsUUID()
    missionUUID: string;
}
