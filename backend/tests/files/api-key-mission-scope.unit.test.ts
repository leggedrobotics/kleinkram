import { FileQueryService } from '@/services/file-query.service';
import { FileQueryDto } from '@kleinkram/api-dto';
import { ForbiddenException } from '@nestjs/common';

const MISSION_A = '11111111-1111-4111-8111-111111111111';
const MISSION_B = '22222222-2222-4222-8222-222222222222';

/**
 * `resolveMissionScope` only reads its arguments, so the repositories the
 * service is otherwise built from are not needed here.
 */
const buildService = (): FileQueryService =>
    new (FileQueryService as unknown as new () => FileQueryService)();

const buildQuery = (parts: Partial<FileQueryDto>): FileQueryDto =>
    parts as FileQueryDto;

describe('FileQueryService.resolveMissionScope', () => {
    let service: FileQueryService;

    beforeEach(() => {
        service = buildService();
    });

    test('a cookie authenticated user keeps the requested missions', () => {
        expect(
            service.resolveMissionScope(
                buildQuery({ missionUuids: [MISSION_A, MISSION_B] }),
            ),
        ).toEqual({ missionUuids: [MISSION_A, MISSION_B] });
    });

    test('a cookie authenticated user without a mission filter is unrestricted', () => {
        expect(service.resolveMissionScope(buildQuery({}))).toEqual({
            missionUuids: [],
        });
    });

    test('a mission scoped API key without a mission filter is pinned to its mission', () => {
        expect(service.resolveMissionScope(buildQuery({}), MISSION_A)).toEqual({
            missionUuids: [MISSION_A],
            enforcedMissionUuid: MISSION_A,
        });
    });

    test('a mission scoped API key may ask for its own mission', () => {
        expect(
            service.resolveMissionScope(
                buildQuery({ missionUUID: MISSION_A }),
                MISSION_A,
            ),
        ).toEqual({
            missionUuids: [MISSION_A],
            enforcedMissionUuid: MISSION_A,
        });
    });

    test('a mission scoped API key cannot ask for another mission via missionUUID', () => {
        expect(() =>
            service.resolveMissionScope(
                buildQuery({ missionUUID: MISSION_B }),
                MISSION_A,
            ),
        ).toThrow(ForbiddenException);
    });

    test('a mission scoped API key cannot ask for another mission via missionUuids', () => {
        expect(() =>
            service.resolveMissionScope(
                buildQuery({ missionUuids: [MISSION_A, MISSION_B] }),
                MISSION_A,
            ),
        ).toThrow(ForbiddenException);
    });
});
