import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitDB1765270980400 implements MigrationInterface {
    name = 'InitDB1765270980400';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "base_entity" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_c576131d32964047fc36dfcdd8b" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."account_provider_enum" AS ENUM('google', 'github', 'fake-oauth')`,
        );
        await queryRunner.query(
            `CREATE TABLE "account" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "provider" "public"."account_provider_enum" NOT NULL, "oauthID" character varying NOT NULL, CONSTRAINT "provider_oauthID" UNIQUE ("provider", "oauthID"), CONSTRAINT "PK_31e2fd7720a2da3af586f17778f" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."apikey_key_type_enum" AS ENUM('ACTION')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."apikey_rights_enum" AS ENUM('0', '10', '20', '30', '100')`,
        );
        await queryRunner.query(
            `CREATE TABLE "apikey" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "apikey" uuid NOT NULL DEFAULT uuid_generate_v4(), "key_type" "public"."apikey_key_type_enum" NOT NULL, "rights" "public"."apikey_rights_enum" NOT NULL, "missionUuid" uuid, "userUuid" uuid, CONSTRAINT "UQ_e1a6e9c0229f80fc2604aa3dc61" UNIQUE ("apikey"), CONSTRAINT "PK_c3d118f7d34d4df9ccad270ab10" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."mission_access_rights_enum" AS ENUM('0', '10', '20', '30', '100')`,
        );
        await queryRunner.query(
            `CREATE TABLE "mission_access" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "rights" "public"."mission_access_rights_enum" NOT NULL, "accessGroupUuid" uuid NOT NULL, "missionUuid" uuid NOT NULL, CONSTRAINT "no_duplicated_access_groups_per_mission" UNIQUE ("accessGroupUuid", "missionUuid"), CONSTRAINT "PK_91e94cb40d7175c7fc4237fa3aa" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."project_access_rights_enum" AS ENUM('0', '10', '20', '30', '100')`,
        );
        await queryRunner.query(
            `CREATE TABLE "project_access" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "rights" "public"."project_access_rights_enum" NOT NULL, "accessGroupUuid" uuid NOT NULL, "projectUuid" uuid NOT NULL, CONSTRAINT "no_duplicated_access_groups_per_project" UNIQUE ("accessGroupUuid", "projectUuid"), CONSTRAINT "PK_84729ed1241ba0527207a417a95" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."access_group_type_enum" AS ENUM('AFFILIATION', 'PRIMARY', 'CUSTOM')`,
        );
        await queryRunner.query(
            `CREATE TABLE "access_group" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "type" "public"."access_group_type_enum" NOT NULL DEFAULT 'CUSTOM', "hidden" boolean NOT NULL DEFAULT false, "creatorUuid" uuid, CONSTRAINT "unique_access_group_name" UNIQUE ("name"), CONSTRAINT "PK_69db32968467cf78399397e3d2c" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "group_membership" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "expirationDate" TIMESTAMP, "canEditGroup" boolean NOT NULL DEFAULT false, "accessGroupUuid" uuid, "userUuid" uuid, CONSTRAINT "no_duplicated_user_in_access_group" UNIQUE ("accessGroupUuid", "userUuid"), CONSTRAINT "PK_c8e1e8674077673f6a7db02ec36" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "category" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "projectUuid" uuid, "creatorUuid" uuid, CONSTRAINT "unique_category_name_per_project" UNIQUE ("name", "projectUuid"), CONSTRAINT "PK_86ee096735ccbfa3fd319af1833" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "topic" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "type" character varying NOT NULL, "nrMessages" bigint NOT NULL, "messageEncoding" character varying NOT NULL DEFAULT '', "frequency" double precision NOT NULL, "fileUuid" uuid, CONSTRAINT "PK_de180fa646be66ad9dad729af58" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_type_enum" AS ENUM('BAG', 'MCAP', 'YAML', 'SVO2', 'TUM', 'DB3', 'ALL')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_state_enum" AS ENUM('OK', 'CORRUPTED', 'UPLOADING', 'ERROR', 'CONVERTING', 'CONVERSION_ERROR', 'LOST', 'FOUND')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_entity_origin_enum" AS ENUM('GOOGLE_DRIVE', 'UPLOAD', 'CONVERTED', 'UNKNOWN')`,
        );
        await queryRunner.query(
            `CREATE TABLE "file_entity" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "date" TIMESTAMP NOT NULL, "filename" character varying NOT NULL, "size" bigint NOT NULL, "type" "public"."file_entity_type_enum" NOT NULL, "state" "public"."file_entity_state_enum" NOT NULL DEFAULT 'OK', "hash" character varying, "origin" "public"."file_entity_origin_enum", "missionUuid" uuid NOT NULL, "creatorUuid" uuid NOT NULL, "parentUuid" uuid, CONSTRAINT "unique_file_name_per_mission" UNIQUE ("filename", "missionUuid"), CONSTRAINT "PK_728a42a0fbdf3fc5f5a42c85e12" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."ingestion_job_state_enum" AS ENUM('0', '10', '20', '21', '22', '23', '30', '40', '41', '42', '43', '44')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."ingestion_job_location_enum" AS ENUM('DRIVE', 'MINIO')`,
        );
        await queryRunner.query(
            `CREATE TABLE "ingestion_job" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "identifier" character varying NOT NULL, "display_name" character varying NOT NULL DEFAULT '', "state" "public"."ingestion_job_state_enum" NOT NULL DEFAULT '0', "location" "public"."ingestion_job_location_enum" NOT NULL DEFAULT 'MINIO', "processingDuration" integer, "errorMessage" character varying, "missionUuid" uuid, "creatorUuid" uuid, "file_uuid" uuid, CONSTRAINT "PK_00938e6d7367135f29fc98a536d" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "project" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "description" character varying NOT NULL, "autoConvert" boolean NOT NULL DEFAULT false, "creatorUuid" uuid NOT NULL, CONSTRAINT "UQ_dedfea394088ed136ddadeee89c" UNIQUE ("name"), CONSTRAINT "PK_bcbc9244374131f3ccb908aa616" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."tag_type_datatype_enum" AS ENUM('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'LOCATION', 'LINK', 'ANY')`,
        );
        await queryRunner.query(
            `CREATE TABLE "tag_type" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "description" character varying, "datatype" "public"."tag_type_datatype_enum" NOT NULL, CONSTRAINT "PK_92bf1776a059ea820f934bf2046" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "tag" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "STRING" character varying, "NUMBER" double precision, "BOOLEAN" boolean, "DATE" TIMESTAMP, "LOCATION" character varying, "missionUuid" uuid, "tagTypeUuid" uuid, "creatorUuid" uuid, CONSTRAINT "PK_d70de2c1e1a3b52adb904028ea2" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."user_role_enum" AS ENUM('ADMIN', 'USER')`,
        );
        await queryRunner.query(
            `CREATE TABLE "user" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "email" character varying NOT NULL, "role" "public"."user_role_enum" NOT NULL DEFAULT 'USER', "hidden" boolean NOT NULL DEFAULT false, "avatarUrl" character varying, "account_uuid" uuid, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "REL_86922df84877163a10338c04b9" UNIQUE ("account_uuid"), CONSTRAINT "PK_a95e949168be7b7ece1a2382fed" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_template_accessrights_enum" AS ENUM('0', '10', '20', '30', '100')`,
        );
        await queryRunner.query(
            `CREATE TABLE "action_template" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "image_name" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "command" character varying, "version" integer NOT NULL DEFAULT '1', "isArchived" boolean NOT NULL DEFAULT false, "cpuCores" integer NOT NULL, "cpuMemory" integer NOT NULL, "gpuMemory" integer NOT NULL, "maxRuntime" integer NOT NULL, "entrypoint" character varying, "accessRights" "public"."action_template_accessrights_enum" NOT NULL, "creatorUuid" uuid, CONSTRAINT "unique_versioned_action_name" UNIQUE ("name", "version"), CONSTRAINT "PK_2bb7f72e54fe56c5413945ad8ea" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "worker" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "identifier" character varying NOT NULL, "hostname" character varying NOT NULL, "cpuMemory" integer NOT NULL, "gpuModel" character varying, "gpuMemory" integer NOT NULL DEFAULT '-1', "cpuCores" integer NOT NULL, "cpuModel" character varying NOT NULL, "storage" integer NOT NULL, "lastSeen" TIMESTAMP NOT NULL, "reachable" boolean NOT NULL, CONSTRAINT "UQ_187e709b9ca210ebafd74e59746" UNIQUE ("identifier"), CONSTRAINT "PK_52e67de404e8f86a670a5ba9359" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_state_enum" AS ENUM('PENDING', 'STARTING', 'PROCESSING', 'STOPPING', 'DONE', 'FAILED', 'UNPROCESSABLE')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."action_artifacts_enum" AS ENUM('10', '20', '30', '40')`,
        );
        await queryRunner.query(
            `CREATE TABLE "action" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "state" "public"."action_state_enum" NOT NULL, "container" json, "state_cause" character varying, "executionStartedAt" TIMESTAMP, "executionEndedAt" TIMESTAMP, "actionContainerStartedAt" TIMESTAMP, "actionContainerExitedAt" TIMESTAMP, "logs" json, "auditLogs" json DEFAULT '[]', "exit_code" integer, "artifact_path" character varying, "artifacts" "public"."action_artifacts_enum" NOT NULL DEFAULT '10', "artifact_size" integer, "artifact_files" json, "image" json, "creatorUuid" uuid NOT NULL, "missionUuid" uuid NOT NULL, "keyUuid" uuid, "templateUuid" uuid NOT NULL, "workerUuid" uuid, CONSTRAINT "REL_15c15b200913cf5234c0668cea" UNIQUE ("keyUuid"), CONSTRAINT "PK_3d098eae105d38b5f16e2156bd7" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "mission" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "projectUuid" uuid NOT NULL, "creatorUuid" uuid NOT NULL, CONSTRAINT "unique_mission_name_per_project" UNIQUE ("name", "projectUuid"), CONSTRAINT "PK_f5a9057579e3281d6a6d29d4165" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."file_event_type_enum" AS ENUM('CREATED', 'DELETED', 'UPLOAD_STARTED', 'UPLOAD_COMPLETED', 'TOPICS_EXTRACTED', 'FILE_CONVERTED', 'FILE_CONVERTED_FROM', 'FOXGLOVE_URL_GENERATED', 'DOWNLOADED', 'RENAMED', 'MOVED')`,
        );
        await queryRunner.query(
            `CREATE TABLE "file_event" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."file_event_type_enum" NOT NULL, "details" jsonb NOT NULL DEFAULT '{}', "filenameSnapshot" character varying NOT NULL, "actorUuid" uuid, "fileUuid" uuid, "missionUuid" uuid, "actionUuid" uuid, CONSTRAINT "PK_23cba1e0668c8a66d01ecb41174" PRIMARY KEY ("uuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_c6842eae6923ae6b85f30edcc0" ON "file_event" ("missionUuid") `,
        );
        await queryRunner.query(
            `CREATE TABLE "file_entity_categories_category" ("fileEntityUuid" uuid NOT NULL, "categoryUuid" uuid NOT NULL, CONSTRAINT "PK_d4ccff0045962eee4b5e017e82e" PRIMARY KEY ("fileEntityUuid", "categoryUuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_cc5fe2ad0324099241345de79c" ON "file_entity_categories_category" ("fileEntityUuid") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_11fa102cb9cd8159957e630e9c" ON "file_entity_categories_category" ("categoryUuid") `,
        );
        await queryRunner.query(
            `CREATE TABLE "tag_type_project_project" ("tagTypeUuid" uuid NOT NULL, "projectUuid" uuid NOT NULL, CONSTRAINT "PK_40fa37b8e026b9367654ed0d91a" PRIMARY KEY ("tagTypeUuid", "projectUuid"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_680533992be5f8a6d5664f1efa" ON "tag_type_project_project" ("tagTypeUuid") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_524b6f4291e81c3f9292f04439" ON "tag_type_project_project" ("projectUuid") `,
        );
        await queryRunner.query(
            `ALTER TABLE "apikey" ADD CONSTRAINT "FK_5dddd9b83adf747bf1806737513" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "apikey" ADD CONSTRAINT "FK_f40e504202030871c12066e1473" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission_access" ADD CONSTRAINT "FK_4c2f153a8894f810bcf56f400bb" FOREIGN KEY ("accessGroupUuid") REFERENCES "access_group"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission_access" ADD CONSTRAINT "FK_8bace5ae0a58b1ba00e65d19b2f" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_access" ADD CONSTRAINT "FK_dc67b017e6be874a564bc3c0d1a" FOREIGN KEY ("accessGroupUuid") REFERENCES "access_group"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_access" ADD CONSTRAINT "FK_910e204772fdc68732f3728f28a" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" ADD CONSTRAINT "FK_d7623d6ba5a2747e0accf801698" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "group_membership" ADD CONSTRAINT "FK_96fbddb1f06db780a4907d81def" FOREIGN KEY ("accessGroupUuid") REFERENCES "access_group"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "group_membership" ADD CONSTRAINT "FK_6b4d2fbf128cee85f97f082933e" FOREIGN KEY ("userUuid") REFERENCES "user"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "category" ADD CONSTRAINT "FK_6ec7022a4305bc7097017759d74" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "category" ADD CONSTRAINT "FK_b0ebe26a74adea2c452566606b5" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "topic" ADD CONSTRAINT "FK_fb4c54e905bdc7895aeba9618b9" FOREIGN KEY ("fileUuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD CONSTRAINT "FK_cff24fb6f37558b50778134d281" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD CONSTRAINT "FK_2a601a65aeaa1d39169e2c1b91c" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" ADD CONSTRAINT "FK_95ecf2a5d930a10916273fbd125" FOREIGN KEY ("parentUuid") REFERENCES "file_entity"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "ingestion_job" ADD CONSTRAINT "FK_f1ba404e1b48afbafbf54cce023" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "ingestion_job" ADD CONSTRAINT "FK_b9f36e5a7ac9a5558c979d98df7" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "ingestion_job" ADD CONSTRAINT "FK_8d8fbf807f561c2679e584877e1" FOREIGN KEY ("file_uuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "project" ADD CONSTRAINT "FK_3efb531ce858475d93ca2c8d8f7" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag" ADD CONSTRAINT "FK_be048a4c67f6daafd6735543c18" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag" ADD CONSTRAINT "FK_5d69bfb6df54eb228617b29afda" FOREIGN KEY ("tagTypeUuid") REFERENCES "tag_type"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag" ADD CONSTRAINT "FK_9857972d0bb698a79a9a9e1497f" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "user" ADD CONSTRAINT "FK_86922df84877163a10338c04b98" FOREIGN KEY ("account_uuid") REFERENCES "account"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" ADD CONSTRAINT "FK_2c6ce32d7ef9690cd202506ddff" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD CONSTRAINT "FK_65d5fd46d2baf1d1d04aed18fc1" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD CONSTRAINT "FK_44d0bfccde4ea3a017dfde75aa8" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD CONSTRAINT "FK_15c15b200913cf5234c0668cea0" FOREIGN KEY ("keyUuid") REFERENCES "apikey"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD CONSTRAINT "FK_d5a3c19901c8aefc82ddd4edae6" FOREIGN KEY ("templateUuid") REFERENCES "action_template"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" ADD CONSTRAINT "FK_8add324fcb3c33f895a48ad2f5f" FOREIGN KEY ("workerUuid") REFERENCES "worker"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" ADD CONSTRAINT "FK_6d71c0142267fbeaba6cae0e5db" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" ADD CONSTRAINT "FK_09a47a85ae3cc20dd215278c93e" FOREIGN KEY ("creatorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ADD CONSTRAINT "FK_752903e26f3ab3df2bb241ff272" FOREIGN KEY ("actorUuid") REFERENCES "user"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ADD CONSTRAINT "FK_fbb38fb11ab9e75a08367572498" FOREIGN KEY ("fileUuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ADD CONSTRAINT "FK_c6842eae6923ae6b85f30edcc09" FOREIGN KEY ("missionUuid") REFERENCES "mission"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" ADD CONSTRAINT "FK_2238e243c3519db9e8931704b23" FOREIGN KEY ("actionUuid") REFERENCES "action"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" ADD CONSTRAINT "FK_cc5fe2ad0324099241345de79c9" FOREIGN KEY ("fileEntityUuid") REFERENCES "file_entity"("uuid") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" ADD CONSTRAINT "FK_11fa102cb9cd8159957e630e9c6" FOREIGN KEY ("categoryUuid") REFERENCES "category"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" ADD CONSTRAINT "FK_680533992be5f8a6d5664f1efa0" FOREIGN KEY ("tagTypeUuid") REFERENCES "tag_type"("uuid") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" ADD CONSTRAINT "FK_524b6f4291e81c3f9292f044399" FOREIGN KEY ("projectUuid") REFERENCES "project"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `CREATE VIEW "mission_access_view_entity" AS SELECT "mission"."uuid" as missionUUID, "user"."uuid" as userUUID, MAX("missionAccesses"."rights") as rights FROM "mission" "mission" INNER JOIN "mission_access" "missionAccesses" ON "missionAccesses"."missionUuid"="mission"."uuid" AND ("missionAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="missionAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ("memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "mission"."deletedAt" IS NULL GROUP BY "mission"."uuid", "user"."uuid"`,
        );
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'mission_access_view_entity',
                'SELECT "mission"."uuid" as missionUUID, "user"."uuid" as userUUID, MAX("missionAccesses"."rights") as rights FROM "mission" "mission" INNER JOIN "mission_access" "missionAccesses" ON "missionAccesses"."missionUuid"="mission"."uuid" AND ("missionAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="missionAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ("memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "mission"."deletedAt" IS NULL GROUP BY "mission"."uuid", "user"."uuid"',
            ],
        );
        await queryRunner.query(
            `CREATE VIEW "project_access_view_entity" AS SELECT "project"."uuid" as projectUUID, "user"."uuid" as userUUID, MAX("projectAccesses"."rights") as rights FROM "project" "project" INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid"="project"."uuid" AND ("projectAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="projectAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ( "memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW() AND "memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "project"."deletedAt" IS NULL GROUP BY "project"."uuid", "user"."uuid"`,
        );
        await queryRunner.query(
            `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
            [
                'public',
                'VIEW',
                'project_access_view_entity',
                'SELECT "project"."uuid" as projectUUID, "user"."uuid" as userUUID, MAX("projectAccesses"."rights") as rights FROM "project" "project" INNER JOIN "project_access" "projectAccesses" ON "projectAccesses"."projectUuid"="project"."uuid" AND ("projectAccesses"."deletedAt" IS NULL)  INNER JOIN "access_group" "accessGroup" ON "accessGroup"."uuid"="projectAccesses"."accessGroupUuid" AND ("accessGroup"."deletedAt" IS NULL)  INNER JOIN "group_membership" "memberships" ON "memberships"."accessGroupUuid"="accessGroup"."uuid" AND ( "memberships"."expirationDate" IS NULL OR "memberships"."expirationDate" > NOW() AND "memberships"."deletedAt" IS NULL)  INNER JOIN "user" "user" ON "user"."uuid"="memberships"."userUuid" AND ("user"."deletedAt" IS NULL) WHERE "project"."deletedAt" IS NULL GROUP BY "project"."uuid", "user"."uuid"',
            ],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'project_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "project_access_view_entity"`);
        await queryRunner.query(
            `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
            ['VIEW', 'mission_access_view_entity', 'public'],
        );
        await queryRunner.query(`DROP VIEW "mission_access_view_entity"`);
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" DROP CONSTRAINT "FK_524b6f4291e81c3f9292f044399"`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag_type_project_project" DROP CONSTRAINT "FK_680533992be5f8a6d5664f1efa0"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" DROP CONSTRAINT "FK_11fa102cb9cd8159957e630e9c6"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity_categories_category" DROP CONSTRAINT "FK_cc5fe2ad0324099241345de79c9"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" DROP CONSTRAINT "FK_2238e243c3519db9e8931704b23"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" DROP CONSTRAINT "FK_c6842eae6923ae6b85f30edcc09"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" DROP CONSTRAINT "FK_fbb38fb11ab9e75a08367572498"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_event" DROP CONSTRAINT "FK_752903e26f3ab3df2bb241ff272"`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" DROP CONSTRAINT "FK_09a47a85ae3cc20dd215278c93e"`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission" DROP CONSTRAINT "FK_6d71c0142267fbeaba6cae0e5db"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT "FK_8add324fcb3c33f895a48ad2f5f"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT "FK_d5a3c19901c8aefc82ddd4edae6"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT "FK_15c15b200913cf5234c0668cea0"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT "FK_44d0bfccde4ea3a017dfde75aa8"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action" DROP CONSTRAINT "FK_65d5fd46d2baf1d1d04aed18fc1"`,
        );
        await queryRunner.query(
            `ALTER TABLE "action_template" DROP CONSTRAINT "FK_2c6ce32d7ef9690cd202506ddff"`,
        );
        await queryRunner.query(
            `ALTER TABLE "user" DROP CONSTRAINT "FK_86922df84877163a10338c04b98"`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag" DROP CONSTRAINT "FK_9857972d0bb698a79a9a9e1497f"`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag" DROP CONSTRAINT "FK_5d69bfb6df54eb228617b29afda"`,
        );
        await queryRunner.query(
            `ALTER TABLE "tag" DROP CONSTRAINT "FK_be048a4c67f6daafd6735543c18"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project" DROP CONSTRAINT "FK_3efb531ce858475d93ca2c8d8f7"`,
        );
        await queryRunner.query(
            `ALTER TABLE "ingestion_job" DROP CONSTRAINT "FK_8d8fbf807f561c2679e584877e1"`,
        );
        await queryRunner.query(
            `ALTER TABLE "ingestion_job" DROP CONSTRAINT "FK_b9f36e5a7ac9a5558c979d98df7"`,
        );
        await queryRunner.query(
            `ALTER TABLE "ingestion_job" DROP CONSTRAINT "FK_f1ba404e1b48afbafbf54cce023"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP CONSTRAINT "FK_95ecf2a5d930a10916273fbd125"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP CONSTRAINT "FK_2a601a65aeaa1d39169e2c1b91c"`,
        );
        await queryRunner.query(
            `ALTER TABLE "file_entity" DROP CONSTRAINT "FK_cff24fb6f37558b50778134d281"`,
        );
        await queryRunner.query(
            `ALTER TABLE "topic" DROP CONSTRAINT "FK_fb4c54e905bdc7895aeba9618b9"`,
        );
        await queryRunner.query(
            `ALTER TABLE "category" DROP CONSTRAINT "FK_b0ebe26a74adea2c452566606b5"`,
        );
        await queryRunner.query(
            `ALTER TABLE "category" DROP CONSTRAINT "FK_6ec7022a4305bc7097017759d74"`,
        );
        await queryRunner.query(
            `ALTER TABLE "group_membership" DROP CONSTRAINT "FK_6b4d2fbf128cee85f97f082933e"`,
        );
        await queryRunner.query(
            `ALTER TABLE "group_membership" DROP CONSTRAINT "FK_96fbddb1f06db780a4907d81def"`,
        );
        await queryRunner.query(
            `ALTER TABLE "access_group" DROP CONSTRAINT "FK_d7623d6ba5a2747e0accf801698"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_access" DROP CONSTRAINT "FK_910e204772fdc68732f3728f28a"`,
        );
        await queryRunner.query(
            `ALTER TABLE "project_access" DROP CONSTRAINT "FK_dc67b017e6be874a564bc3c0d1a"`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission_access" DROP CONSTRAINT "FK_8bace5ae0a58b1ba00e65d19b2f"`,
        );
        await queryRunner.query(
            `ALTER TABLE "mission_access" DROP CONSTRAINT "FK_4c2f153a8894f810bcf56f400bb"`,
        );
        await queryRunner.query(
            `ALTER TABLE "apikey" DROP CONSTRAINT "FK_f40e504202030871c12066e1473"`,
        );
        await queryRunner.query(
            `ALTER TABLE "apikey" DROP CONSTRAINT "FK_5dddd9b83adf747bf1806737513"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_524b6f4291e81c3f9292f04439"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_680533992be5f8a6d5664f1efa"`,
        );
        await queryRunner.query(`DROP TABLE "tag_type_project_project"`);
        await queryRunner.query(
            `DROP INDEX "public"."IDX_11fa102cb9cd8159957e630e9c"`,
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_cc5fe2ad0324099241345de79c"`,
        );
        await queryRunner.query(`DROP TABLE "file_entity_categories_category"`);
        await queryRunner.query(
            `DROP INDEX "public"."IDX_c6842eae6923ae6b85f30edcc0"`,
        );
        await queryRunner.query(`DROP TABLE "file_event"`);
        await queryRunner.query(`DROP TYPE "public"."file_event_type_enum"`);
        await queryRunner.query(`DROP TABLE "mission"`);
        await queryRunner.query(`DROP TABLE "action"`);
        await queryRunner.query(`DROP TYPE "public"."action_artifacts_enum"`);
        await queryRunner.query(`DROP TYPE "public"."action_state_enum"`);
        await queryRunner.query(`DROP TABLE "worker"`);
        await queryRunner.query(`DROP TABLE "action_template"`);
        await queryRunner.query(
            `DROP TYPE "public"."action_template_accessrights_enum"`,
        );
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
        await queryRunner.query(`DROP TABLE "tag"`);
        await queryRunner.query(`DROP TABLE "tag_type"`);
        await queryRunner.query(`DROP TYPE "public"."tag_type_datatype_enum"`);
        await queryRunner.query(`DROP TABLE "project"`);
        await queryRunner.query(`DROP TABLE "ingestion_job"`);
        await queryRunner.query(
            `DROP TYPE "public"."ingestion_job_location_enum"`,
        );
        await queryRunner.query(
            `DROP TYPE "public"."ingestion_job_state_enum"`,
        );
        await queryRunner.query(`DROP TABLE "file_entity"`);
        await queryRunner.query(`DROP TYPE "public"."file_entity_origin_enum"`);
        await queryRunner.query(`DROP TYPE "public"."file_entity_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."file_entity_type_enum"`);
        await queryRunner.query(`DROP TABLE "topic"`);
        await queryRunner.query(`DROP TABLE "category"`);
        await queryRunner.query(`DROP TABLE "group_membership"`);
        await queryRunner.query(`DROP TABLE "access_group"`);
        await queryRunner.query(`DROP TYPE "public"."access_group_type_enum"`);
        await queryRunner.query(`DROP TABLE "project_access"`);
        await queryRunner.query(
            `DROP TYPE "public"."project_access_rights_enum"`,
        );
        await queryRunner.query(`DROP TABLE "mission_access"`);
        await queryRunner.query(
            `DROP TYPE "public"."mission_access_rights_enum"`,
        );
        await queryRunner.query(`DROP TABLE "apikey"`);
        await queryRunner.query(`DROP TYPE "public"."apikey_rights_enum"`);
        await queryRunner.query(`DROP TYPE "public"."apikey_key_type_enum"`);
        await queryRunner.query(`DROP TABLE "account"`);
        await queryRunner.query(`DROP TYPE "public"."account_provider_enum"`);
        await queryRunner.query(`DROP TABLE "base_entity"`);
    }
}
