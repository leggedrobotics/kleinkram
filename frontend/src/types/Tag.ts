import { DataType } from 'src/enums/TAG_TYPES';
import { formatDate } from 'src/services/dateFormating';
import { BaseEntity } from 'src/types/BaseEntity';
import { TagType } from 'src/types/TagType';

/* eslint-disable @typescript-eslint/naming-convention */
export class Tag extends BaseEntity {
    STRING?: string;
    NUMBER?: number;
    BOOLEAN?: boolean;
    DATE?: Date;
    LOCATION?: string;
    type: TagType;

    constructor(
        uuid: string,
        STRING: string | undefined,
        NUMBER: number | undefined,
        BOOLEAN: boolean | undefined,
        DATE: Date | undefined,
        LOCATION: string | undefined,
        type: TagType,
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.STRING = STRING;
        this.NUMBER = NUMBER;
        this.BOOLEAN = BOOLEAN;
        this.DATE = DATE;
        this.LOCATION = LOCATION;
        this.type = type;
    }

    asString(): string {
        switch (this.type.type) {
            case DataType.BOOLEAN:
                return this.BOOLEAN ? 'true' : 'false';
            case DataType.DATE:
                return formatDate(this.DATE as Date);
            case DataType.LOCATION:
                return this.LOCATION as string;
            case DataType.NUMBER:
                return this.NUMBER?.toString() || '';
            case DataType.STRING:
            case DataType.LINK:
                return this.STRING as string;
            default:
                return '';
        }
    }
    static fromAPIResponse(response: any): Tag {
        return new Tag(
            response.uuid,
            response.STRING,
            response.NUMBER,
            response.BOOLEAN,
            response.DATE ? new Date(response.DATE) : undefined,
            response.LOCATION,
            TagType.fromAPIResponse(response.type),
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}
