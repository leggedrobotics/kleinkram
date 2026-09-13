import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileVersions1789238000000 implements MigrationInterface {
    name = 'AddFileVersions1789238000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create enum types for file_version_entity if they don't exist
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_version_entity_type_enum') THEN
                    CREATE TYPE "public"."file_version_entity_type_enum" AS ENUM('BAG', 'MCAP', 'YAML', 'SVO2', 'TUM', 'DB3', 'ALL');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_version_entity_state_enum') THEN
                    CREATE TYPE "public"."file_version_entity_state_enum" AS ENUM('OK', 'CORRUPTED', 'UPLOADING', 'ERROR', 'CONVERTING', 'CONVERSION_ERROR', 'LOST', 'FOUND', 'CANCELED');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_version_entity_origin_enum') THEN
                    CREATE TYPE "public"."file_version_entity_origin_enum" AS ENUM('GOOGLE_DRIVE', 'UPLOAD', 'CONVERTED', 'UNKNOWN');
                END IF;
            END $$;
        `);

        // 2. Create file_version_entity table
        await queryRunner.query(`
            CREATE TABLE "file_version_entity" (\n                "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP,
                "versionNumber" integer NOT NULL DEFAULT '1',
                "fileUuid" uuid NOT NULL,
                "date" TIMESTAMP NOT NULL,
                "size" bigint NOT NULL,
                "type" "public"."file_version_entity_type_enum" NOT NULL,
                "state" "public"."file_version_entity_state_enum" NOT NULL DEFAULT 'OK',
                "state_cause" character varying,
                "hash" character varying,
                "origin" "public"."file_version_entity_origin_enum",
                "recordingStartDate" TIMESTAMP,
                "recordingEndDate" TIMESTAMP,
                "recordingTimesCheckedAt" TIMESTAMP,
                CONSTRAINT "PK_file_version_entity_uuid" PRIMARY KEY ("uuid")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_c2cc560353e6f938554a7ded5f" ON "file_version_entity" ("deletedAt")
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "unique_file_version_number" ON "file_version_entity" ("fileUuid", "versionNumber") WHERE "deletedAt" IS NULL
        `);

        // 3. Add activeVersionUuid and temporary new_file_uuid column to file_entity
        await queryRunner.query(`
            ALTER TABLE "file_entity" ADD COLUMN "activeVersionUuid" uuid
        `);
        await queryRunner.query(`
            ALTER TABLE "file_entity" ADD COLUMN "new_file_uuid" uuid DEFAULT gen_random_uuid()
        `);
        // Ensure all rows have a distinct new_file_uuid
        await queryRunner.query(`
            UPDATE "file_entity" SET "new_file_uuid" = gen_random_uuid()
        `);
        await queryRunner.query(`
            ALTER TABLE "file_entity" ALTER COLUMN "new_file_uuid" SET NOT NULL
        `);

        // 4. Populate file_version_entity with existing file data
        // Existing file uuid is preserved as file_version_entity.uuid!
        // file_version_entity.fileUuid points to file_entity.new_file_uuid.
        await queryRunner.query(`
            INSERT INTO "file_version_entity" (
                "uuid",
                "createdAt",
                "updatedAt",
                "deletedAt",
                "versionNumber",
                "fileUuid",
                "date",
                "size",
                "type",
                "state",
                "hash",
                "origin",
                "recordingStartDate",
                "recordingEndDate",
                "recordingTimesCheckedAt"
            )
            SELECT
                "uuid",
                "createdAt",
                "updatedAt",
                "deletedAt",
                1,
                "new_file_uuid",
                COALESCE("date", "createdAt", now()),
                COALESCE("size", 0),
                "type"::text::"public"."file_version_entity_type_enum",
                COALESCE("state"::text::"public"."file_version_entity_state_enum", 'OK'),
                "hash",
                "origin"::text::"public"."file_version_entity_origin_enum",
                "recordingStartDate",
                "recordingEndDate",
                "recordingTimesCheckedAt"
            FROM "file_entity"
        `);

        // Set activeVersionUuid to existing uuid (which is now file_version_entity.uuid)
        await queryRunner.query(`
            UPDATE "file_entity" SET "activeVersionUuid" = "uuid"
        `);

        // 5. Drop foreign key constraints pointing to file_entity(uuid)
        await queryRunner.query(
            `ALTER TABLE "topic" DROP CONSTRAINT IF EXISTS "FK_fb4c54e905bdc7895aeba9618b9"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" DROP CONSTRAINT IF EXISTS "FK_cc5fe2ad0324099241345de79c9"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" DROP CONSTRAINT IF EXISTS "FK_fbb38fb11ab9e75a08367572498"`,
        );
        await queryRunner.query(
            `ALTER TABLE "ingestion_job" DROP CONSTRAINT IF EXISTS "FK_8d8fbf807f561c2679e584877e1"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT IF EXISTS "FK_b32d5c5f495f0825273afa03e69"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP CONSTRAINT IF EXISTS "FK_95ecf2a5d930a10916273fbd125"`,
        );

        // 6. Update foreign keys in referencing tables to new_file_uuid
        await queryRunner.query(`
            UPDATE "file_entity_categories_category" c
            SET "fileEntityUuid" = f."new_file_uuid"
            FROM "file_entity" f
            WHERE c."fileEntityUuid" = f."uuid"
        `);
        await queryRunner.query(`
            UPDATE "file_event" e
            SET "fileUuid" = f."new_file_uuid"
            FROM "file_entity" f
            WHERE e."fileUuid" = f."uuid"
        `);
        await queryRunner.query(`
            UPDATE "ingestion_job" j
            SET "file_uuid" = f."new_file_uuid"
            FROM "file_entity" f
            WHERE j."file_uuid" = f."uuid"
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'action' AND column_name = 'fileUuid'
                ) THEN
                    UPDATE "action" a
                    SET "fileUuid" = f."new_file_uuid"
                    FROM "file_entity" f
                    WHERE a."fileUuid" = f."uuid";
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            UPDATE "file_entity" c
            SET "parentUuid" = p."new_file_uuid"
            FROM "file_entity" p
            WHERE c."parentUuid" = p."uuid"
        `);

        // 7. Topic points to file_version_entity(uuid)
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'topic' AND column_name = 'fileUuid'
                ) THEN
                    ALTER TABLE "topic" RENAME COLUMN "fileUuid" TO "fileVersionUuid";
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "topic" ADD CONSTRAINT "FK_f6e034f8bfd13df9df40da281d0"
            FOREIGN KEY ("fileVersionUuid") REFERENCES "file_version_entity"("uuid") ON DELETE CASCADE
        `);

        // 8. Swap file_entity.uuid to new_file_uuid
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP CONSTRAINT "PK_728a42a0fbdf3fc5f5a42c85e12"`,
        );
        await queryRunner.query(
            `UPDATE "file_entity" SET "uuid" = "new_file_uuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN "new_file_uuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD CONSTRAINT "PK_728a42a0fbdf3fc5f5a42c85e12" PRIMARY KEY ("uuid")`,
        );

        // 9. Re-attach foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "file_version_entity" ADD CONSTRAINT "FK_e99a5ae00a8d9b9d443e19881c3"
            FOREIGN KEY ("fileUuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "file_entity" ADD CONSTRAINT "FK_237e9065a8118df0853e308424d"
            FOREIGN KEY ("activeVersionUuid") REFERENCES "file_version_entity"("uuid") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED
        `);
        await queryRunner.query(`
            ALTER TABLE "file_entity_categories_category" ADD CONSTRAINT "FK_cc5fe2ad0324099241345de79c9"
            FOREIGN KEY ("fileEntityUuid") REFERENCES "file_entity"("uuid") ON UPDATE CASCADE ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "file_event" ADD CONSTRAINT "FK_fbb38fb11ab9e75a08367572498"
            FOREIGN KEY ("fileUuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "ingestion_job" ADD CONSTRAINT "FK_8d8fbf807f561c2679e584877e1"
            FOREIGN KEY ("file_uuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'action' AND column_name = 'fileUuid'
                ) THEN
                    ALTER TABLE "action" ADD CONSTRAINT "FK_b32d5c5f495f0825273afa03e69"
                    FOREIGN KEY ("fileUuid") REFERENCES "file_entity"("uuid") ON DELETE SET NULL;
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "file_entity" ADD CONSTRAINT "FK_95ecf2a5d930a10916273fbd125"
            FOREIGN KEY ("parentUuid") REFERENCES "file_entity"("uuid") ON DELETE SET NULL
        `);

        // 10. Drop migrated columns and old enums from file_entity
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "date"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "size"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "type"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "state"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "hash"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "origin"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "recordingStartDate"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "recordingEndDate"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "recordingTimesCheckedAt"`,
        );

        await queryRunner.query(
            `DROP TYPE IF EXISTS "public"."file_entity_origin_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE IF EXISTS "public"."file_entity_state_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE IF EXISTS "public"."file_entity_type_enum"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-create old enum types
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_entity_type_enum') THEN
                    CREATE TYPE "public"."file_entity_type_enum" AS ENUM('BAG', 'MCAP', 'YAML', 'SVO2', 'TUM', 'DB3', 'ALL');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_entity_state_enum') THEN
                    CREATE TYPE "public"."file_entity_state_enum" AS ENUM('OK', 'CORRUPTED', 'UPLOADING', 'ERROR', 'CONVERTING', 'CONVERSION_ERROR', 'LOST', 'FOUND', 'CANCELED');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_entity_origin_enum') THEN
                    CREATE TYPE "public"."file_entity_origin_enum" AS ENUM('GOOGLE_DRIVE', 'UPLOAD', 'CONVERTED', 'UNKNOWN');
                END IF;
            END $$;
        `);

        // Re-add columns to file_entity
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "date" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "size" bigint`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "type" "public"."file_entity_type_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "state" "public"."file_entity_state_enum"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "hash" character varying DEFAULT ''`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "origin" "public"."file_entity_origin_enum" DEFAULT 'UPLOAD'`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "recordingStartDate" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "recordingEndDate" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD COLUMN "recordingTimesCheckedAt" TIMESTAMP`,
        );

        // Copy active version data back to file_entity
        await queryRunner.query(`
            UPDATE "file_entity" f
            SET
                "date" = v."date",
                "size" = v."size",
                "type" = v."type"::text::"public"."file_entity_type_enum",
                "state" = v."state"::text::"public"."file_entity_state_enum",
                "hash" = v."hash",
                "origin" = v."origin"::text::"public"."file_entity_origin_enum",
                "recordingStartDate" = v."recordingStartDate",
                "recordingEndDate" = v."recordingEndDate",
                "recordingTimesCheckedAt" = v."recordingTimesCheckedAt"
            FROM "file_version_entity" v
            WHERE f."activeVersionUuid" = v."uuid"
        `);

        // Drop FKs
        await queryRunner.query(
            `ALTER TABLE "topic" DROP CONSTRAINT IF EXISTS "FK_f6e034f8bfd13df9df40da281d0"`,
        );

        // Remap topic references from physical version UUID back to logical file UUID before restoring FK
        await queryRunner.query(`
            UPDATE "topic" t
            SET "fileVersionUuid" = v."fileUuid"
            FROM "file_version_entity" v
            WHERE t."fileVersionUuid" = v."uuid"
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'topic' AND column_name = 'fileVersionUuid'
                ) THEN
                    ALTER TABLE "topic" RENAME COLUMN "fileVersionUuid" TO "fileUuid";
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "topic" ADD CONSTRAINT "FK_fb4c54e905bdc7895aeba9618b9"
            FOREIGN KEY ("fileUuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE
        `);

        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP CONSTRAINT IF EXISTS "FK_237e9065a8118df0853e308424d"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP COLUMN IF EXISTS "activeVersionUuid"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_version_entity" DROP CONSTRAINT IF EXISTS "FK_e99a5ae00a8d9b9d443e19881c3"`,
        );
        await queryRunner.query(`DROP TABLE "file_version_entity"`);
        await queryRunner.query(
            `DROP TYPE IF EXISTS "public"."file_version_entity_origin_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE IF EXISTS "public"."file_version_entity_state_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE IF EXISTS "public"."file_version_entity_type_enum"`,
        );
    }
}
