import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMission {
    @IsString()
    @IsNotEmpty()
    name: string;
    @IsUUID()
    projectUUID: string;

    @IsNotEmpty()
    tags: Record<string, string>;
}
