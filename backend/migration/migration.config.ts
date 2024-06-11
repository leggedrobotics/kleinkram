import { getConfig } from './datasource.config';
import { DataSource } from 'typeorm';

const datasource = new DataSource(getConfig());
datasource.initialize();
export default datasource;
