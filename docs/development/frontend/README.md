# Frontend
Check out the Vue Documentation [here](https://v3.vuejs.org/guide/introduction.html) and the Quasar Documentation [here](https://quasar.dev/).
## Structure
Within the `frontend` directory, at the root level are the key configuration files for the frontend application. The `src` directory contains the source code for the application. The `public` directory contains the static files for the application

### Configuration Files
- `package.json` - The package.json file contains the dependencies and scripts for the application.
- `quasar.conf.js` - The Quasar configuration file contains the configuration for the Quasar Framework.
- `tsconfig.json` - The TypeScript configuration file contains the configuration for the TypeScript compiler.
- `Dockefile` - The Dockerfile contains the instructions to build the Docker image for the application.
- `dev.Dockerfile` - The dev.Dockerfile contains the instructions to build the Docker image for the application in development mode.
- `.env` - The .env file contains the environment variables for the application.
- and some less important files

### Source Code
- `api` - The configuration of the API with [Axios](https://axios-http.com/)
- `assets` - The assets directory contains the images, fonts, and styles for the application.
- `boot` - Files injected into the Vue App: VueQuery and Router
- `components` - Contains our custom components.
- `css` - Contains the global css files. Currently not used
- `enum` - The enum files
- `layouts` - The layouts in which the pages are rendered
- `pages` - The pages. Each page has its own route.
- `router` - The router configuration
- `services` - The function & classes used repeatedly in the application
  - `auth.ts` - Authentication functions
  - `dateFromating.ts` - Date formatting: Date to String and String to Date
  - `generalFormating.ts` - Currently only: Byte to Human readable format
  - `mutation.ts` - Functions calling the API to mutate data: POST, PUT, DELETE. 
     ::: info
     Should be spit by endpoint
     :::
  - `queries.ts` - Functions calling the API to get data: GET. The data returned by the endpoint is wrapped into classes. This includes coverting datestrings to Date objects.
    ::: info
    Should definitively be spit by endpoint
    :::
  - `routerService.ts` - Functions to navigate the application
- `types` - The typescript types / classes
- `env.ts` - Wrapper for the env variables

## Development
Use the eslinter and prettier to format the code. The code should be formatted before committing. The code should be linted before pushing. The code should be tested before merging.