import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsValidFileName } from '../../validation/propertyDecorator';

export class UpdateFile {
    @IsUUID() uuid: string;
    @IsValidFileName() @IsString() filename: string;
    @IsOptional() @IsUUID() mission_uuid?: string;
    @IsOptional() @IsUUID() project_uuid?: string;
    @IsDate() date: Date;
}
