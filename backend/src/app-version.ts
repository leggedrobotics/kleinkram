import fs from 'node:fs';

interface PackageJson {
    name?: string;
    version?: string;
    description?: string;
}

const packageJson = JSON.parse(
    fs.readFileSync('/usr/src/app/backend/package.json', 'utf8'),
) as PackageJson;

/**
 * The version of the application as defined in the package.json file.
 */
export const appVersion = packageJson.version || '';
