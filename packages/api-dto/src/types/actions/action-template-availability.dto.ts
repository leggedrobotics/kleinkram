import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ActionTemplateAvailabilityDto {
    @ApiProperty({
        description: 'Indicates if the template name is available for use',
    })
    @IsBoolean()
    available!: boolean;
}
