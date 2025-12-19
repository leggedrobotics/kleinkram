/* eslint-disable unicorn/prefer-top-level-await, unicorn/no-process-exit */
import { DataSource, DataSourceOptions } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { dataSourceOptions } from '../ormconfig';

const dataSource = new DataSource(dataSourceOptions as DataSourceOptions);

(async () => {
    await dataSource.initialize();

    await runSeeders(dataSource, {
        seeds: dataSourceOptions.seeds,
        factories: dataSourceOptions.factories,
    });

    await dataSource.destroy();
})().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
