import {
    CreateDateColumn,
    DeleteDateColumn, Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { IsUUID } from 'class-validator';

/**
 * Base entity class that others inherit from.
 * Includes unique UUID, as well as creation/modification/deletion timestamps
 */
@Entity()
export default class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    @IsUUID()
    uuid: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt?: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}