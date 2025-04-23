import fs, { accessSync, constants } from 'node:fs';

interface PackageJson {
    name?: string;
    version?: string;
    description?: string;
}

const path = '/usr/src/app/backend/package.json';
const fallbackPath = '../package.json';

function readFileIfExists(filePath: string): PackageJson | null {
    try {
        // Check if the file exists and is readable.
        accessSync(filePath, constants.R_OK);
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PackageJson;
    } catch {
        return null;
    }
}

/**
 * The version of the application as defined in the package.json file.
 */
export const appVersion = (() => {
    let packageJson = readFileIfExists(path);

    if (!packageJson) {
        packageJson = readFileIfExists(fallbackPath);
    }

    return packageJson?.version ?? '';
})();
