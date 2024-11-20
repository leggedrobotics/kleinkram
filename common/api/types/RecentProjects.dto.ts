import { ApiProperty } from '@nestjs/swagger';

export class ResentProjectDto {
    @ApiProperty()
    uuid: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    description: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class ResentProjectsDto {
    @ApiProperty()
    projects: ResentProjectDto[];
}
