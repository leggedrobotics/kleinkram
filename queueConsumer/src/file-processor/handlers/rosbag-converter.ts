import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import logger from '../../logger';
import { traceWrapper } from '../../tracing';

const execFilePromise = promisify(execFile);

export const RosBagConverter = {
    /**
     * Wrapper around the 'mcap' CLI tool.
     * Converts a ROS1 .bag file to a ROS2 .mcap file.
     */
    async convert(inputFile: string, outputFile: string): Promise<void> {
        return traceWrapper(async (): Promise<void> => {
            logger.debug(`Converting ${inputFile} -> ${outputFile}`);

            // The paths contain user-controlled file names (e.g. Drive
            // imports), so they must be passed as arguments and never go
            // through a shell, where `$(...)` would still expand inside quotes.
            await execFilePromise('mcap', ['convert', inputFile, outputFile]);

            logger.debug(`Conversion successful: ${outputFile}`);
        }, 'RosBagConverter.convert')();
    },
};
