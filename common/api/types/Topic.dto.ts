import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class TopicDto {}

export class TopicsDto {
    @ApiProperty()
    @IsNumber()
    count!: number;

    //@ApiProperty()
    //files!: TopicDto[];
}
