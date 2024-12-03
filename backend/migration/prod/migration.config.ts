import { DataSource } from 'typeorm';
import { getConfig } from './prod_datasource.config';

const datasource = new DataSource(getConfig());

datasource
    .initialize()
    .then(console.log)
    .catch((error: unknown) => {
        console.error(error);
    });
export default datasource;
