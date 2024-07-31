import { DataType } from 'src/enums/TAG_TYPES';
import { BaseEntity } from 'src/types/BaseEntity';

export class TagType extends BaseEntity {
    name: string;
    type: DataType;

    constructor(
        uuid: string,
        name: string,
        type: DataType,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.type = type;
    }
}
