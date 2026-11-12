import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSessions1794495661218 implements MigrationInterface {
    name = 'AddUserSessions1794495661218';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."user_session_kind_enum" AS ENUM('WEB', 'CLI')`,
        );
        await queryRunner.query(
            `CREATE TABLE "user_session" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "userUuid" uuid NOT NULL, "kind" "public"."user_session_kind_enum" NOT NULL, "name" character varying(255), "platform" character varying(255), "clientVersion" character varying(64), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "revokedReason" character varying(32), "generation" integer NOT NULL DEFAULT '0', "rotatedAt" TIMESTAMP WITH TIME ZONE, "secret" character varying(64) NOT NULL, CONSTRAINT "PK_7a3cd692f090009c9cb1125119e" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_user_session_user" ON "user_session"  ("userUuid", "revokedAt") `,
        );
        await queryRunner.query(
            `ALTER TABLE "user_session" ADD CONSTRAINT "FK_50c067e12cc7793ca9d4ef78f08" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "user_session" DROP CONSTRAINT "FK_50c067e12cc7793ca9d4ef78f08"`,
        );
        await queryRunner.query(`DROP INDEX "public"."idx_user_session_user"`);
        await queryRunner.query(`DROP TABLE "user_session"`);
        await queryRunner.query(`DROP TYPE "public"."user_session_kind_enum"`);
    }
}
