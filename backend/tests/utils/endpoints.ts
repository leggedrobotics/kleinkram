import assert from 'node:assert';
import fs from 'node:fs';

export const getEndpoints = (): {
    url: string;
    method: string;
}[] => {
    // load endpoints from __generated__endpoints.json
    assert.ok(
        fs.existsSync('.endpoints/__generated__endpoints.json'),
        'endpoints file does not exist. Run the server to generate it',
    );
    const fileContent = fs.readFileSync(
        '.endpoints/__generated__endpoints.json',
        'utf8',
    );
    return JSON.parse(fileContent);
};
