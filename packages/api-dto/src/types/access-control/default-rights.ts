import { DefaultRightDto } from '@api-dto/access-control/default-right.dto';
import { Paginated } from '@api-dto/pagination';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

export class DefaultRights implements Paginated<DefaultRightDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [DefaultRightDto],
        description: 'List of default rights',
    })
    @ValidateNested()
    @Type(() => DefaultRightDto)
    data!: DefaultRightDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
