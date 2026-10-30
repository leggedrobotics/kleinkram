import 'tsconfig-paths/register';
import { DataSource } from 'typeorm';
import { getConfig } from './development-datasource.config';

// The TypeORM CLI initializes the data source itself and fails if it is
// already connected, so it must not be initialized here.
export default new DataSource(getConfig());
