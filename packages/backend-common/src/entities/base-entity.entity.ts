import {
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Base entities class that others inherit from.
 * Includes unique UUID, as well as creation/modification/deletion timestamps
 */
@Entity()
export class BaseEntity {
    /**
     * Unique UUID for the entity
     */
    @PrimaryGeneratedColumn('uuid')
    uuid!: string;

    /**
     * Timestamp of when the entity was created
     */
    @CreateDateColumn()
    createdAt!: Date;

    /**
     * Timestamp of when the entity was last updated
     */
    @UpdateDateColumn()
    updatedAt!: Date;

    /**
     * Timestamp of when the entity was deleted.
     * This field is used to soft-delete entities.
     */
    @Index()
    @DeleteDateColumn({ select: false })
    deletedAt?: Date;
}

/**
 * Spread into the values of a `Repository.update()` to leave `updatedAt` as it
 * is. Without it TypeORM sets `updatedAt = CURRENT_TIMESTAMP` on every update.
 *
 * Use it for writes the system makes on its own, such as backfills or repair
 * jobs. Those fill in derived data and do not change what a user sees as the
 * entity's content. `updatedAt` feeds "last updated" in the UI (the recently
 * used projects on the dashboard, for example), so a backfill that runs over
 * thousands of files must not make all their projects look freshly edited.
 */
export const KEEP_UPDATED_AT = {
    updatedAt: (): string => '"updatedAt"',
} as const;
