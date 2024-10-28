import { BaseEntity } from 'src/types/BaseEntity';

export class Topic extends BaseEntity {
    name: string;
    type: string;
    nrMessages: number;
    frequency: number;

    constructor(
        uuid: string,
        name: string,
        type: string,
        nrMessages: number,
        frequency: number,
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.type = type;
        this.nrMessages = nrMessages;
        this.frequency = frequency;
    }
}
