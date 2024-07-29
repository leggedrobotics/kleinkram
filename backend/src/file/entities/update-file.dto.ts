import {IsDate, IsOptional, IsString, IsUUID} from "class-validator";

export class UpdateFile {
    @IsUUID() uuid: string;
    @IsString() filename: string;
    @IsOptional() @IsUUID() mission_uuid?: string;
    @IsOptional() @IsUUID() project_uuid?: string;
    @IsDate() date: Date;
}
