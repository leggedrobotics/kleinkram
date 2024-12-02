import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    name!: string;
}

export class CategoriesDto {
    count!: number;
    categories!: CategoryDto[];
}
