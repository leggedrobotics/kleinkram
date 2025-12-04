import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min } from 'class-validator';

export class UnauthorizedExceptionDto {
    @ApiProperty()
    @IsString()
    message!: string;

    @ApiProperty()
    @IsNumber()
    @Min(401)
    @Max(401)
    statusCode!: 401;
}
