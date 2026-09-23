import 'tsconfig-paths/register';
import { DataSource } from 'typeorm';
import { getConfig } from './production-datasource.config';

const datasource = new DataSource(getConfig());

datasource
    .initialize()
    .then((ds) => {
        // eslint-disable-next-line no-console
        console.log(
            `Connected to ${ds.options.database as string} on ${(ds.options as { host?: string }).host ?? 'unknown host'}`,
        );
    })
    // eslint-disable-next-line unicorn/prefer-top-level-await
    .catch((error: unknown) => {
        console.error(error);
    });
export default datasource;
