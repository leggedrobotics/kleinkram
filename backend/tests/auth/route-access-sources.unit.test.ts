import { AccessController } from '@/endpoints/access/access.controller';
import {
    ACCESS_SOURCE_METADATA_KEY,
    AccessSource,
} from '@/endpoints/auth/access-source';
import { CategoryController } from '@/endpoints/category/category.controller';
import { FileController } from '@/endpoints/file/file.controller';
import { MetadataController } from '@/endpoints/metadata/metadata.controller';
import { MissionController } from '@/endpoints/mission/mission.controller';
import { ProjectController } from '@/endpoints/project/project.controller';
import { TriggerController } from '@/endpoints/trigger/trigger.controller';
import 'reflect-metadata';

/**
 * The declared access source of every guarded route.
 *
 * This is the authorization contract of the API: the guard reads the resource
 * uuid from exactly this location, so it has to match the parameter the handler
 * itself works with. Adding a guarded route without adding it here (or changing
 * where a handler reads its uuid from) has to fail this test.
 */
interface ControllerLike {
    name: string;
    prototype: object;
}

const EXPECTED_ACCESS_SOURCES: [ControllerLike, string, AccessSource][] = [
    // --- files -----------------------------------------------------------
    [FileController, 'download', { from: 'param', key: 'uuid' }],
    [FileController, 'update', { from: 'param', key: 'uuid' }],
    [FileController, 'getOneFileByName', { from: 'query', key: 'uuid' }],
    [FileController, 'deleteFile', { from: 'param', key: 'uuid' }],
    [
        FileController,
        'getTemporaryAccess',
        { from: 'body', key: 'missionUUID' },
    ],
    [FileController, 'deleteMultiple', { from: 'body', key: 'missionUUID' }],
    [FileController, 'exists', { from: 'query', key: 'uuid' }],
    [FileController, 'getEvents', { from: 'param', key: 'uuid' }],
    [FileController, 'getFoxgloveLink', { from: 'param', key: 'uuid' }],
    [FileController, 'importFromDrive', { from: 'body', key: 'missionUUID' }],
    [FileController, 'getFileById', { from: 'param', key: 'uuid' }],

    // --- missions --------------------------------------------------------
    [MissionController, 'createMission', { from: 'body', key: 'projectUUID' }],
    [MissionController, 'updateMissionName', { from: 'param', key: 'uuid' }],
    [MissionController, 'getMissionById', { from: 'param', key: 'uuid' }],
    [MissionController, 'downloadWithToken', { from: 'param', key: 'uuid' }],
    [MissionController, 'deleteMission', { from: 'param', key: 'uuid' }],
    [MissionController, 'addTags', { from: 'param', key: 'uuid' }],

    // --- projects --------------------------------------------------------
    [ProjectController, 'getProjectById', { from: 'param', key: 'uuid' }],
    [ProjectController, 'updateProject', { from: 'param', key: 'uuid' }],
    [ProjectController, 'deleteProject', { from: 'param', key: 'uuid' }],
    [ProjectController, 'addUserToProject', { from: 'param', key: 'uuid' }],
    [ProjectController, 'addTagType', { from: 'param', key: 'uuid' }],
    [ProjectController, 'removeTagType', { from: 'param', key: 'uuid' }],
    [ProjectController, 'updateTagTypes', { from: 'param', key: 'uuid' }],
    [ProjectController, 'getProjectAccess', { from: 'param', key: 'uuid' }],
    [ProjectController, 'updateProjectAccess', { from: 'param', key: 'uuid' }],

    // --- access groups ---------------------------------------------------
    // `uuid` is the access group here, the project is `projectUuid`.
    [
        AccessController,
        'addAccessGroupToProject',
        { from: 'param', key: 'projectUuid' },
    ],
    [
        AccessController,
        'removeAccessGroupFromProject',
        { from: 'param', key: 'projectUuid' },
    ],

    // --- categories ------------------------------------------------------
    [CategoryController, 'getAll', { from: 'query', key: 'projectUuid' }],
    [
        CategoryController,
        'createCategory',
        { from: 'body', key: 'projectUUID' },
    ],
    [
        CategoryController,
        'addManyCategories',
        { from: 'body', key: 'missionUUID' },
    ],

    // --- triggers --------------------------------------------------------
    [TriggerController, 'create', { from: 'body', key: 'missionUuid' }],

    // --- metadata --------------------------------------------------------
    [MetadataController, 'deleteTag', { from: 'param', key: 'uuid' }],
];

describe('Guarded routes declare where their resource uuid lives', () => {
    test.each(EXPECTED_ACCESS_SOURCES)(
        '%s.%s',
        (controller, handlerName, expected) => {
            const handler = (controller.prototype as Record<string, unknown>)[
                handlerName
            ];
            expect(handler).toBeDefined();

            const source = Reflect.getMetadata(
                ACCESS_SOURCE_METADATA_KEY,
                handler as object,
            ) as AccessSource | undefined;

            expect(source).toEqual(expected);
        },
    );
});
