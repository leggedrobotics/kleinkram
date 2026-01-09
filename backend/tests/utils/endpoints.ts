import assert from 'node:assert';
import fs from 'node:fs';

export const getEndpoints = (): {
    url: string;
    method: string;
}[] => {
    const filePath = '.endpoints/__generated__endpoints.json';

    assert.ok(
        fs.existsSync(filePath),
        'endpoints file does not exist. Run the server to generate it',
    );
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsedContent = JSON.parse(fileContent);
    assert.ok(
        Array.isArray(parsedContent),
        'endpoints file is not an array. Run the server to generate it',
    );

    assert.ok(
        parsedContent.length > 0 &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            typeof parsedContent[0].url === 'string' &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            typeof parsedContent[0].method === 'string',
        'endpoints file is not in the correct format. Run the server to generate it',
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return parsedContent;
};
