import { ApiProperty } from '@nestjs/swagger';

export class ProjectDto {
    @ApiProperty()
    uuid!: string;
}
