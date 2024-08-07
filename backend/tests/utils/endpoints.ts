import assert from 'node:assert';

export const get_endpoints = () => {
    // load endpoints from __generated__endpoints.json
    const fs = require('fs');
    assert.ok(
        fs.existsSync('__generated__endpoints.json'),
        'endpoints file does not exist. Run the server to generate it',
    );
    const file_content = fs.readFileSync('__generated__endpoints.json');
    return JSON.parse(file_content);
};
