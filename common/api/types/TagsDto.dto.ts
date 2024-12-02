import { ApiProperty } from '@nestjs/swagger';
import { DataType } from '../../frontend_shared/enum';

export class TagTypeDto {
    @ApiProperty()
    name!: string;

    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    datatype!: DataType;

    @ApiProperty()
    description?: string;
}

export class TagDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    description!: string;

    @ApiProperty()
    datatype!: DataType;

    @ApiProperty()
    type!: TagTypeDto;

    @ApiProperty()
    value!: string | Date | number | boolean;

    get valueAsString(): string {
        return this.value.toString();
    }
}

export class TagsDto {
    @ApiProperty()
    tags!: TagDto[];

    @ApiProperty()
    count!: number;
}

export class TagTypesDto {
    @ApiProperty()
    tagTypes!: TagTypeDto[];

    @ApiProperty()
    count!: number;
}
