import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import {
    IsNoValidUUID,
    IsValidFileName,
} from '../../validation/propertyDecorator';

export class UpdateFile {
    @IsUUID() uuid: string;

    @IsNoValidUUID() @IsValidFileName() @IsString() filename: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    @IsOptional() @IsUUID() mission_uuid?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    @IsOptional() @IsUUID() project_uuid?: string;
    @IsDate() date: Date;
    @IsOptional() @IsUUID('all', { each: true }) categories: string[];
}
