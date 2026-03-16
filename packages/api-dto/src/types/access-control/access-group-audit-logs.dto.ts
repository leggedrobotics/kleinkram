import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsArray, IsNumber, ValidateNested } from 'class-validator';
import { AccessGroupAuditLogDto } from './access-group-audit-log.dto';

export class AccessGroupAuditLogsDto {
    @Expose()
    @ApiProperty({ type: () => [AccessGroupAuditLogDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AccessGroupAuditLogDto)
    data!: AccessGroupAuditLogDto[];

    @Expose()
    @ApiProperty()
    @IsNumber()
    count!: number;
}
