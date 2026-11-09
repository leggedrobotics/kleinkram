import {
    CreateAccessGroupDto,
    CreateMission,
    CreateProject,
    UpdateMissionNameDto,
} from '@kleinkram/api-dto';
import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';

const SOME_UUID = '3f2ad2c6-6e2a-4c6b-9a1d-9f6f0f3b7f21';

/**
 * Project, mission and access group names share one set of rules, see
 * `packages/validation/src/name.validation.ts`. These tests run the same
 * `ValidationPipe` configuration the application installs globally.
 */
describe('Name validation', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    });

    const validate = async (
        metatype: ArgumentMetadata['metatype'],
        value: unknown,
    ): Promise<string[]> => {
        try {
            await pipe.transform(value, { type: 'body', metatype });
            return [];
        } catch (error) {
            return (
                (error as { response?: { message?: string[] } }).response
                    ?.message ?? ['unknown error']
            );
        }
    };

    const project = (name: string): Promise<string[]> =>
        validate(CreateProject, { name, description: 'description' });

    it.each(['abc', 'field-testing-2024', 'v1.2', 'a'.repeat(100)])(
        'accepts %s',
        async (name) => {
            expect(await project(name)).toEqual([]);
        },
    );

    it.each([
        ['ab', 'Project name must be at least 3 characters long'],
        ['a'.repeat(101), 'Project name must be at most 100 characters long'],
        [SOME_UUID, 'Project name must not be a UUID'],
        ['.hidden', 'Project name must not start with \'.\'. Try "hidden".'],
        [
            'My Project',
            "Project name may only contain letters, digits, '.', '-' and '_' (found space). Try \"My-Project\".",
        ],
    ])('rejects %s', async (name, message) => {
        expect(await project(name)).toEqual([message]);
    });

    it('applies the same rules to missions and access groups', async () => {
        expect(
            await validate(CreateMission, {
                name: 'Mission 1',
                projectUUID: SOME_UUID,
                metadata: {},
            }),
        ).toEqual([
            "Mission name may only contain letters, digits, '.', '-' and '_' (found space). Try \"Mission-1\".",
        ]);
        expect(
            await validate(UpdateMissionNameDto, { name: 'mission.v2' }),
        ).toEqual([]);
        expect(await validate(CreateAccessGroupDto, { name: 'ab' })).toEqual([
            'Group name must be at least 3 characters long',
        ]);
    });
});
