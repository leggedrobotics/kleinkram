# Database Migration
This folder contains the database migration scripts. 

Add a .env file in this folder with the following content:
```
prod_dbpassword=<password>
dev_dbpassword=<password>
local_dbpassword=dbuserpass
```

Then you can create new migration scripts by running the following commands:
```
yarn run typeorm migration:generate migration/dev/migrations/test -d migration/dev/migration.config.ts     
yarn run typeorm migration:generate migration/local/migrations/test -d migration/local/migration.config.ts     
yarn run typeorm migration:generate migration/prod/migrations/test -d migration/prod/migration.config.ts     
```
from within the backend folder. This will create a new migration script in the migration/migrations folder.
This migration script can then be run by running the following command:
```
yarn run typeorm migration:run -- -d migration/dev/migration.config.ts    
yarn run typeorm migration:run -- -d migration/local/migration.config.ts    
yarn run typeorm migration:run -- -d migration/prod/migration.config.ts    
```
or reverted by running:
```
yarn run typeorm migration:revert -- -d migration/dev/migration.config.ts    
yarn run typeorm migration:revert -- -d migration/local/migration.config.ts    
yarn run typeorm migration:revert -- -d migration/prod/migration.config.ts    
```
