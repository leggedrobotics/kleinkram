import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import {
    IsNoValidUUID,
    IsValidFileName,
} from '../../validation/propertyDecorator';

export class CreatePreSignedURLSDto {
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    @IsValidFileName({ each: true })
    @IsNoValidUUID({ each: true })
    filenames: string[];

    @IsUUID()
    missionUUID: string;
}
