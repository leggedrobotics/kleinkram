import assert from 'node:assert';

export const getEndpoints = () => {
    // load endpoints from __generated__endpoints.json
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    assert.ok(
        fs.existsSync('.endpoints/__generated__endpoints.json'),
        'endpoints file does not exist. Run the server to generate it',
    );
    const fileContent = fs.readFileSync(
        '.endpoints/__generated__endpoints.json',
    );
    return JSON.parse(fileContent);
};
