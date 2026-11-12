import { UserEntity } from '@backend-common/entities/user/user.entity';
import { SessionKind } from '@kleinkram/shared';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
} from 'typeorm';

/**
 * One login of a user, in the web app or the CLI.
 *
 * The refresh token of a session is never stored: it is derived from the
 * session, its `generation` and `secret` with an HMAC keyed by the server's
 * JWT secret, see `SessionService`. Every refresh increases the generation,
 * so a copied old refresh token is detected and ends the session.
 *
 * Access tokens name their session (`sid`), so revoking a session takes
 * effect on the next request.
 */
@Index('idx_user_session_user', ['userUuid', 'revokedAt'])
@Entity({ name: 'user_session' })
export class SessionEntity {
    @Column({ primary: true, generated: 'uuid' })
    uuid!: string;

    @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
    user?: UserEntity;

    @Column({ type: 'uuid' })
    userUuid!: string;

    @Column({ type: 'enum', enum: SessionKind })
    kind!: SessionKind;

    /** Browser or host name, shown in the list of sessions. */
    @Column({ type: 'varchar', length: 255, nullable: true })
    name?: string | null;

    /** Operating system, shown in the list of sessions. */
    @Column({ type: 'varchar', length: 255, nullable: true })
    platform?: string | null;

    /** CLI or web app version that started the session. */
    @Column({ type: 'varchar', length: 64, nullable: true })
    clientVersion?: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    /** Last refresh; the idle limit counts from here. */
    @Column({ type: 'timestamptz' })
    lastUsedAt!: Date;

    /** Absolute end of the session, no matter how actively it is used. */
    @Column({ type: 'timestamptz' })
    expiresAt!: Date;

    @Column({ type: 'timestamptz', nullable: true })
    revokedAt?: Date | null;

    /** Why the session ended early, e.g. `logout`, `user`, `reuse`. */
    @Column({ type: 'varchar', length: 32, nullable: true })
    revokedReason?: string | null;

    /** Number of the current refresh token, increased on every rotation. */
    @Column({ type: 'integer', default: 0 })
    generation!: number;

    /** When the current refresh token replaced the previous one. */
    @Column({ type: 'timestamptz', nullable: true })
    rotatedAt?: Date | null;

    /** Per-session input to the refresh token HMAC. */
    @Column({ type: 'varchar', length: 64, select: false })
    secret!: string;
}
