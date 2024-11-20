import { BaseEntity } from 'src/types/BaseEntity';
import { DataType } from '@common/enum';

export class TagType extends BaseEntity {
    name: string;
    type: DataType;

    constructor(
        uuid: string,
        name: string,
        type: DataType,
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.type = type;
    }

    static fromAPIResponse(response: any): TagType {
        return new TagType(
            response.uuid,
            response.name,
            response.type,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}
