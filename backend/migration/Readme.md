# Database Migration
This folder contains the database migration scripts. 

Add a .env file in this folder with the following content:
```
dbpassword=your_password
```

Then you can create a new migration script by running the following command:
```
yarn run typeorm migration:generate migration/migrations/test -d migration/migration.config.ts     
```
from within the backend folder. This will create a new migration script in the migration/migrations folder.
This migration script can then be run by running the following command:
```
yarn run typeorm migration:run -- -d migration/migration.config.ts    
```
or reverted by running:
```
yarn run typeorm migration:revert -- -d migration/migration.config.ts    
```
