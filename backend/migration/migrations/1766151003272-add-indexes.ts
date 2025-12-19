import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1766151003272 implements MigrationInterface {
    name = 'AddIndexes1766151003272';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX "IDX_2b0c110b36a490a5458d253911" ON "base_entity" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_2cabb849760babe66490f024e1" ON "account" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_aa2316638d2492c7a5e8a4eccd" ON "group_membership" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_82c1e9e16eb675a12a17d17f1f" ON "topic" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_45208f047f6742a3067fd1d49c" ON "file_entity" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_cff24fb6f37558b50778134d28" ON "file_entity" ("missionUuid") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_294e1e9ea20bb504f382a0d356" ON "category" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_16daeaa9a7c1eeeb4468048d21" ON "tag" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_8102188b489ccc9e092d7c177b" ON "tag_type" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_30310b331b5091f60585828d75" ON "project" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_82e2e7d6f42e4aaac0ed332a92" ON "project_access" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_01369bae653efc42ddf9a572fb" ON "access_group" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_98fc2b4a5cf77e0786d1a43cfa" ON "mission_access" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_7d27162eb31a34e1a5607ec135" ON "ingestion_job" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_39e216d9a16251e209621e8259" ON "mission" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_6d71c0142267fbeaba6cae0e5d" ON "mission" ("projectUuid") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_2fb2f37b515e0d6a6dc4a98888" ON "apikey" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_92f09bd6964a57bb87891a2acf" ON "user" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_c28b07d4ad69e00608d9453324" ON "action_template" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_945a53fd3adb2200313ebb0766" ON "action" ("deletedAt") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_5896a6451354b0fef7e7759dbe" ON "worker" ("deletedAt") `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX "public"."IDX_5896a6451354b0fef7e7759dbe"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_945a53fd3adb2200313ebb0766"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_c28b07d4ad69e00608d9453324"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_92f09bd6964a57bb87891a2acf"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_2fb2f37b515e0d6a6dc4a98888"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_6d71c0142267fbeaba6cae0e5d"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_39e216d9a16251e209621e8259"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_7d27162eb31a34e1a5607ec135"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_98fc2b4a5cf77e0786d1a43cfa"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_01369bae653efc42ddf9a572fb"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_82e2e7d6f42e4aaac0ed332a92"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_30310b331b5091f60585828d75"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_8102188b489ccc9e092d7c177b"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_16daeaa9a7c1eeeb4468048d21"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_294e1e9ea20bb504f382a0d356"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_cff24fb6f37558b50778134d28"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_45208f047f6742a3067fd1d49c"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_82c1e9e16eb675a12a17d17f1f"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_aa2316638d2492c7a5e8a4eccd"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_2cabb849760babe66490f024e1"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_2b0c110b36a490a5458d253911"`,
        );
    }
}
