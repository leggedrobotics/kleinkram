import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Instance-wide settings that admins change at runtime, one row per key.
 * A missing row means the setting has its default value.
 */
@Entity({ name: 'system_setting' })
export class SystemSettingEntity {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    key!: string;

    @Column({ type: 'jsonb' })
    value!: unknown;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}
