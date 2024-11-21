import { getConfig } from './dev_datasource.config';
import { DataSource } from 'typeorm';

const datasource = new DataSource(getConfig());

datasource.initialize().then(console.log).catch(console.error);
export default datasource;
