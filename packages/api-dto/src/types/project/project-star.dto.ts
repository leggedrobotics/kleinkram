import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsUUID } from 'class-validator';

/**
 * The star state of a project for the requesting user, returned by the
 * star/un-star endpoints so that clients do not have to refetch the project.
 */
@Expose()
export class ProjectStarDto {
    @ApiProperty({ description: 'UUID of the project' })
    @IsUUID()
    @Expose()
    projectUuid!: string;

    @ApiProperty({
        description: 'Whether the project is starred by the requesting user',
    })
    @IsBoolean()
    @Expose()
    isStarred!: boolean;
}
