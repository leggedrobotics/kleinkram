import {
    emailMatchesDomain,
    loadAccessConfig,
} from '@kleinkram/backend-common';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { DEV_ACCESS_CONFIG_PATH } from '../../utils/database-utilities';

describe('Access config loading', () => {
    let directory: string;

    const writeConfig = (content: string): string => {
        const file = path.join(directory, 'access_config.json');
        fs.writeFileSync(file, content);
        return file;
    };

    beforeAll(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'access-config-'));
    });

    afterAll(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    test('loads the dev config', () => {
        const config = loadAccessConfig(DEV_ACCESS_CONFIG_PATH);
        expect(config.access_groups.length).toBeGreaterThan(0);
    });

    test('fails if ACCESS_CONFIG_PATH is not set', () => {
        const previous = process.env.ACCESS_CONFIG_PATH;
        delete process.env.ACCESS_CONFIG_PATH;
        try {
            expect(() => loadAccessConfig()).toThrow(
                /ACCESS_CONFIG_PATH is not set/,
            );
        } finally {
            if (previous !== undefined) {
                process.env.ACCESS_CONFIG_PATH = previous;
            }
        }
    });

    test('fails if the file does not exist', () => {
        expect(() =>
            loadAccessConfig(path.join(directory, 'missing.json')),
        ).toThrow(/Cannot read access config/);
    });

    test('fails on malformed JSON', () => {
        const file = writeConfig('{ "emails": [], }');
        expect(() => loadAccessConfig(file)).toThrow(
            /Cannot parse access config/,
        );
    });

    test('fails if the arrays are missing', () => {
        const file = writeConfig('{}');
        expect(() => loadAccessConfig(file)).toThrow(/must be arrays/);
    });

    test('fails if an email entry references an undefined group', () => {
        const file = writeConfig(
            JSON.stringify({
                emails: [
                    {
                        email: 'example.com',
                        access_groups: ['11111111-1111-1111-1111-111111111111'],
                    },
                ],
                access_groups: [],
            }),
        );
        expect(() => loadAccessConfig(file)).toThrow(/is not defined/);
    });

    test('fails if an email entry is not a bare domain', () => {
        const file = writeConfig(
            JSON.stringify({
                emails: [{ email: '@example.com', access_groups: [] }],
                access_groups: [],
            }),
        );
        expect(() => loadAccessConfig(file)).toThrow(/bare mail domain/);
    });
});

describe('emailMatchesDomain', () => {
    test('matches addresses of the domain', () => {
        expect(emailMatchesDomain('alice@example.com', 'example.com')).toBe(
            true,
        );
        expect(emailMatchesDomain('Alice@Example.COM', 'example.com')).toBe(
            true,
        );
    });

    test('does not match look-alike domains or subdomains', () => {
        expect(emailMatchesDomain('eve@evilexample.com', 'example.com')).toBe(
            false,
        );
        expect(emailMatchesDomain('eve@sub.example.com', 'example.com')).toBe(
            false,
        );
        expect(emailMatchesDomain('eve@example.com.evil', 'example.com')).toBe(
            false,
        );
    });
});
