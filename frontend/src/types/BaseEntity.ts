export class BaseEntity {
    uuid: string;
    createdAt: Date | null;
    updatedAt: Date | null;

    protected constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        this.uuid = uuid;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
