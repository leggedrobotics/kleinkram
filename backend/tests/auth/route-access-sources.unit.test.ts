import {
    ACCESS_SOURCE_METADATA_KEY,
    AccessSource,
    fromBody,
    fromParameter,
    fromQuery,
} from '@/endpoints/auth/access-source';
import {
    DeleteTagGuard,
    FileAccessGuard,
    MissionAccessGuard,
    ProjectAccessGuard,
    QueueItemAccessGuard,
} from '@/endpoints/auth/guards';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import 'reflect-metadata';

const ENDPOINTS_DIRECTORY = path.join(
    __dirname,
    '..',
    '..',
    'src',
    'endpoints',
);

/**
 * Guards that authorize against a uuid taken from the request. Every route using
 * one of them has to declare where that uuid lives.
 */
const SOURCE_AWARE_GUARDS = new Set<unknown>([
    MissionAccessGuard,
    FileAccessGuard,
    ProjectAccessGuard,
    DeleteTagGuard,
]);

/**
 * The declared access source of every guarded route, keyed by
 * `<Controller>.<handler>`.
 *
 * This is the authorization contract of the API: the guard reads the resource
 * uuid from exactly this location, so it has to match the parameter the handler
 * itself works with. The routes are discovered from the controllers below, so
 * adding a guarded route without listing it here fails, and so does leaving a
 * stale entry behind.
 */
const EXPECTED_ACCESS_SOURCES = new Map<string, AccessSource>([
    // --- files -----------------------------------------------------------
    ['FileController.download', fromParameter('uuid')],
    ['FileController.update', fromParameter('uuid')],
    ['FileController.getOneFileByName', fromQuery('uuid')],
    ['FileController.deleteFile', fromParameter('uuid')],
    ['FileController.getTemporaryAccess', fromBody('missionUUID')],
    ['FileController.deleteMultiple', fromBody('missionUUID')],
    ['FileController.exists', fromQuery('uuid')],
    ['FileController.getEvents', fromParameter('uuid')],
    ['FileController.getFoxgloveLink', fromParameter('uuid')],
    ['FileController.importFromDrive', fromBody('missionUUID')],
    ['FileController.getFileById', fromParameter('uuid')],
    ['FileController.recover', fromParameter('uuid')],

    // --- missions --------------------------------------------------------
    ['MissionController.createMission', fromBody('projectUUID')],
    ['MissionController.updateMissionName', fromParameter('uuid')],
    ['MissionController.getMissionById', fromParameter('uuid')],
    ['MissionController.downloadWithToken', fromParameter('uuid')],
    ['MissionController.deleteMission', fromParameter('uuid')],
    ['MissionController.addTags', fromParameter('uuid')],

    // --- projects --------------------------------------------------------
    ['ProjectController.getProjectById', fromParameter('uuid')],
    ['ProjectController.updateProject', fromParameter('uuid')],
    ['ProjectController.deleteProject', fromParameter('uuid')],
    ['ProjectController.addUserToProject', fromParameter('uuid')],
    ['ProjectController.addTagType', fromParameter('uuid')],
    ['ProjectController.removeTagType', fromParameter('uuid')],
    ['ProjectController.updateTagTypes', fromParameter('uuid')],
    ['ProjectController.getProjectAccess', fromParameter('uuid')],
    ['ProjectController.updateProjectAccess', fromParameter('uuid')],

    // --- access groups ---------------------------------------------------
    // `uuid` is the access group here, the project is `projectUuid`.
    ['AccessController.addAccessGroupToProject', fromParameter('projectUuid')],
    [
        'AccessController.removeAccessGroupFromProject',
        fromParameter('projectUuid'),
    ],

    // --- categories ------------------------------------------------------
    ['CategoryController.getAll', fromQuery('projectUuid')],
    ['CategoryController.createCategory', fromBody('projectUUID')],
    ['CategoryController.addManyCategories', fromBody('missionUUID')],

    // --- triggers --------------------------------------------------------
    ['TriggerController.create', fromBody('missionUuid')],

    // --- metadata --------------------------------------------------------
    ['MetadataController.deleteTag', fromParameter('uuid')],
]);

/**
 * Routes authorized by the queue guard. It resolves the mission from the
 * ingestion job in the database rather than from the request, so these routes
 * declare no access source.
 */
const EXPECTED_QUEUE_ROUTES = [
    'FileController.deleteQueueItem',
    'FileController.cancelProcessing',
    'FileController.stopJob',
];

const listControllerFiles = (directory: string): string[] => {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listControllerFiles(fullPath));
        } else if (entry.name.endsWith('.controller.ts')) {
            files.push(fullPath);
        }
    }
    return files;
};

interface DiscoveredRoute {
    key: string;
    guards: unknown[];
    accessSource: AccessSource | undefined;
}

/**
 * Imports every `*.controller.ts` below `src/endpoints` and reads the guard and
 * access source metadata Nest stored on each handler.
 */
const discoverRoutes = (): DiscoveredRoute[] => {
    const routes: DiscoveredRoute[] = [];

    for (const file of listControllerFiles(ENDPOINTS_DIRECTORY)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
        const module = require(file);

        for (const exported of Object.values(
            module as Record<string, unknown>,
        )) {
            if (typeof exported !== 'function') continue;
            const prototype = (exported as { prototype?: object }).prototype;
            if (!prototype) continue;

            for (const name of Object.getOwnPropertyNames(prototype)) {
                if (name === 'constructor') continue;
                const handler = Object.getOwnPropertyDescriptor(prototype, name)
                    ?.value as unknown;
                if (typeof handler !== 'function') continue;

                const guards =
                    (Reflect.getMetadata(GUARDS_METADATA, handler) as
                        unknown[] | undefined) ?? [];
                if (guards.length === 0) continue;

                routes.push({
                    key: `${exported.name}.${name}`,
                    guards,
                    accessSource: Reflect.getMetadata(
                        ACCESS_SOURCE_METADATA_KEY,
                        handler,
                    ) as AccessSource | undefined,
                });
            }
        }
    }

    return routes;
};

describe('Guarded routes declare where their resource uuid lives', () => {
    const routes = discoverRoutes();

    const sourceAwareRoutes = routes.filter((route) =>
        route.guards.some((guard) => SOURCE_AWARE_GUARDS.has(guard)),
    );

    test('controllers were discovered', () => {
        expect(routes.length).toBeGreaterThan(0);
        expect(sourceAwareRoutes.length).toBeGreaterThan(0);
    });

    test('the declared sources cover exactly the routes that need one', () => {
        expect(new Set(sourceAwareRoutes.map((route) => route.key))).toEqual(
            new Set(EXPECTED_ACCESS_SOURCES.keys()),
        );
    });

    test('every route reads its uuid from the expected location', () => {
        const actual = new Map(
            sourceAwareRoutes.map((route) => [route.key, route.accessSource]),
        );
        expect(actual).toEqual(EXPECTED_ACCESS_SOURCES);
    });

    test('the queue routes resolve their mission from the ingestion job', () => {
        const queueRoutes = routes.filter((route) =>
            route.guards.includes(QueueItemAccessGuard),
        );

        expect(new Set(queueRoutes.map((route) => route.key))).toEqual(
            new Set(EXPECTED_QUEUE_ROUTES),
        );
        for (const route of queueRoutes) {
            expect(route.accessSource).toBeUndefined();
        }
    });
});
