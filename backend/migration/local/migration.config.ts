import { DataSource } from 'typeorm';
import { getConfig } from './local_datasource.config';

const datasource = new DataSource(getConfig());
// eslint-disable-next-line no-console
datasource.initialize().then(console.log).catch(console.error);
export default datasource;
