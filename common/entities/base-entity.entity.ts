import {
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Base entities class that others inherit from.
 * Includes unique UUID, as well as creation/modification/deletion timestamps
 */
@Entity()
export default class BaseEntity {
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
    @DeleteDateColumn({ select: false })
    deletedAt?: Date;
}
