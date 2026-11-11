import {
    CreateAccessGroupDto,
    CreateMission,
    CreateProject,
    TemporaryAccessRequestDto,
    UpdateFile,
    UpdateMissionNameDto,
} from '@kleinkram/api-dto';
import {
    getFileNameValidationError,
    getNameValidationError,
    SCRIPT_FILENAME_REGEX,
    suggestFileName,
    suggestName,
} from '@kleinkram/validation';
import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface Case {
    value: string;
    error: string | null;
}
interface SuggestionCase {
    value: string;
    suggestion: string | null;
}
interface SharedCases {
    names: { label: string; cases: Case[] };
    suggestName: SuggestionCase[];
    fileNames: { label: string; cases: Case[] };
    suggestFileName: SuggestionCase[];
    scriptFileNames: { value: string; valid: boolean }[];
}

// the CLI tests check the same file, see its `$comment`
const SHARED_CASES = JSON.parse(
    readFileSync(
        path.join(
            __dirname,
            '../../../packages/validation/test-cases/names.json',
        ),
        'utf8',
    ),
) as SharedCases;

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
        [
            '.hidden',
            "Project name must not start with '.' or '-'. Try \"hidden\".",
        ],
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

describe('Shared naming cases (packages/validation/test-cases/names.json)', () => {
    it.each(SHARED_CASES.names.cases)('name $value', ({ value, error }) => {
        expect(
            getNameValidationError(value, SHARED_CASES.names.label) ?? null,
        ).toEqual(error);
    });

    it.each(SHARED_CASES.suggestName)(
        'suggestName $value',
        ({ value, suggestion }) => {
            expect(suggestName(value) ?? null).toEqual(suggestion);
        },
    );

    it.each(SHARED_CASES.fileNames.cases)(
        'file name $value',
        ({ value, error }) => {
            expect(
                getFileNameValidationError(
                    value,
                    SHARED_CASES.fileNames.label,
                ) ?? null,
            ).toEqual(error);
        },
    );

    it.each(SHARED_CASES.suggestFileName)(
        'suggestFileName $value',
        ({ value, suggestion }) => {
            expect(suggestFileName(value) ?? null).toEqual(suggestion);
        },
    );

    it.each(SHARED_CASES.scriptFileNames)(
        'script file name $value',
        ({ value, valid }) => {
            expect(SCRIPT_FILENAME_REGEX.test(value)).toBe(valid);
        },
    );
});

describe('File name validation in requests', () => {
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

    const upload = (filenames: string[]): Promise<string[]> =>
        validate(TemporaryAccessRequestDto, {
            filenames,
            missionUUID: SOME_UUID,
        });

    it('accepts valid names and reports what is wrong with the others', async () => {
        expect(await upload(['run_01.mcap', 'calib.2024.bag'])).toEqual([]);
        // a list of names: the message names the bad entry
        expect(await upload(['run_01.mcap', 'a.bag'])).toEqual([
            'a.bag: File name must be at least 3 characters long without the extension',
        ]);
        expect(await upload(['REC.MCAP'])).toEqual([
            'REC.MCAP: File name must end with a lowercase extension. Try "REC.mcap".',
        ]);
    });

    it('applies the same rule when renaming a file', async () => {
        expect(
            await validate(UpdateFile, {
                uuid: SOME_UUID,
                filename: 'log(1).bag',
                date: '2024-05-14T00:00:00Z',
            }),
        ).toEqual([
            "File name may only contain letters, digits, '.', '-' and '_' (found '(', ')'). Try \"log-1.bag\".",
        ]);
    });
});
