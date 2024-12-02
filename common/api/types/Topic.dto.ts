import { ApiProperty } from '@nestjs/swagger';

export class TopicDto {}

export class TopicsDto {
    @ApiProperty()
    count!: number;

    @ApiProperty()
    files!: TopicDto[];
}
