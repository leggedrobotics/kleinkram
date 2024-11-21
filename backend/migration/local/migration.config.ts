import { DataSource } from 'typeorm';
import { getConfig } from './local_datasource.config';

const datasource = new DataSource(getConfig());

datasource.initialize().then(console.log).catch(console.error);
export default datasource;
