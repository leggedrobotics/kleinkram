import { ApiProperty } from '@nestjs/swagger';

export class ActionDto {}

export class ListOfActionDto {
    @ApiProperty()
    count: number;

    @ApiProperty({
        type: [ActionDto],
        description: 'List of actions',
    })
    actions: ActionDto[];
}
