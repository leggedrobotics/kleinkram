import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePreSignedURLSDto {
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    filenames: string[];

    @IsUUID()
    missionUUID: string;
}
