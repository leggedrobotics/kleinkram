import { DataSource } from 'typeorm';
import { getConfig } from './prod_datasource.config';

const datasource = new DataSource(getConfig());
datasource.initialize();
export default datasource;
