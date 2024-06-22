import { CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Base entities class that others inherit from.
 * Includes unique UUID, as well as creation/modification/deletion timestamps
 */
@Entity()
export default class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    uuid: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt?: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
