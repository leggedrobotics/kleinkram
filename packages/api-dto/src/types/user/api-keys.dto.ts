import { Paginated } from '@api-dto/pagination';
import { ApiKeyMetadataDto } from '@api-dto/user/api-key-metadata.dto';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, ValidateNested } from 'class-validator';

export class ApiKeysDto implements Paginated<ApiKeyMetadataDto> {
    @ApiProperty({
        type: () => [ApiKeyMetadataDto],
        description: 'List of API key metadata',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ApiKeyMetadataDto)
    data!: ApiKeyMetadataDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
