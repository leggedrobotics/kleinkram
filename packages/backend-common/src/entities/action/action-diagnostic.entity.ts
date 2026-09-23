import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { DiagnosticSeverity } from '@kleinkram/shared';
import { Column, CreateDateColumn, Entity, Index, ManyToOne } from 'typeorm';

/**
 * A single message an action container reported about itself while running,
 * through `klein action warn` / `klein action fail`.
 *
 * Diagnostics are how an action says something without having to encode it in
 * its exit code. They are recorded as they arrive rather than at exit, so a
 * container that is later OOM-killed still leaves behind everything it found
 * before it died.
 */
@Index('idx_action_diagnostic_dedup', [
    'actionUuid',
    'severity',
    'code',
    'file',
])
@Entity({ name: 'action_diagnostic' })
export class ActionDiagnosticEntity {
    @Column({ primary: true, generated: 'uuid' })
    uuid!: string;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt!: Date;

    @Column({ type: 'enum', enum: DiagnosticSeverity })
    severity!: DiagnosticSeverity;

    @Column({ type: 'varchar', length: 500 })
    message!: string;

    /**
     * Stable identifier the action author chooses, used to group repeated
     * findings (`MISSING_TF`, `SHORT_RECORDING`). Optional: a one-off warning
     * does not need one.
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    code?: string;

    /**
     * Free-text locator for whatever the diagnostic is about, usually a
     * filename. Deliberately not a foreign key: actions warn about paths inside
     * the container, topics and time ranges as often as they warn about files
     * that exist in the mission.
     */
    @Column({ type: 'varchar', length: 1024, nullable: true })
    file?: string;

    /**
     * How many times this diagnostic was reported. Identical diagnostics are
     * folded into one row with a count rather than stored repeatedly, so a loop
     * over ten thousand files cannot flood the table.
     */
    @Column({ type: 'int', default: 1 })
    count!: number;

    @Column({ type: 'jsonb', nullable: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: Record<string, any>;

    @Index()
    @ManyToOne(() => ActionEntity, (action) => action.diagnostics, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    action?: ActionEntity;

    @Column({ type: 'uuid' })
    actionUuid!: string;
}
