import { DataSource } from 'typeorm';
import { getConfig } from './production-datasource.config';

const datasource = new DataSource(getConfig());

datasource
    .initialize()
    .then(console.log)
    // eslint-disable-next-line unicorn/prefer-top-level-await
    .catch((error: unknown) => {
        console.error(error);
    });
export default datasource;
