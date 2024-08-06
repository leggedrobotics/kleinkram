export class BaseEntity {
    uuid: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    deletedAt: Date | null;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        this.uuid = uuid;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.deletedAt = deletedAt;
    }
}
