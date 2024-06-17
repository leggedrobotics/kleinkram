import { getConfig } from './dev_datasource.config';
import { DataSource } from 'typeorm';

const datasource = new DataSource(getConfig());
datasource.initialize();
export default datasource;
