# Frontend

The Frontend is a Vue3 application with the Quasar Framework & Component Library. It is responsible for the user
interface. The Frontend is statically served by the Nginx in the Frontend container.

::: tip External Resources
Check out the [Vue documentation](https://v3.vuejs.org/guide/introduction.html) and the [Quasar
documentation](https://quasar.dev/).
:::

## Structure

Within the `frontend` directory, at the root level are the key configuration files for the frontend application.
The `src` directory contains the source code for the application. The `public` directory contains the static files for
the application

### Configuration Files

- `package.json` - The dependencies and scripts for the application.
- `quasar.config.ts` - The configuration for the Quasar Framework and the Vite build.
- `tsconfig.json` - The configuration for the TypeScript compiler. Run `pnpm exec quasar prepare` once to generate the
  `.quasar/tsconfig.json` it extends.
- `nginx.conf` - The Nginx configuration of the production image.
- The Docker image is built from `docker/frontend.Dockerfile` in the repository root. The environment variables are
  read at build time, see [Environment Variables](../environment-variables.md).

### Source Code

- `api` - The [Axios](https://axios-http.com/) client, the query keys and API services for actions
- `assets` - The images, fonts, and styles for the application.
- `boot` - Files injected into the Vue App: Vue Query, the router and a WebAssembly polyfill
- `components` - Contains our custom components.
- `composables` - Reusable Vue composition functions (filters, searches, action queries, ...)
- `css` - The global styles (`app.scss`) and the Quasar variables
- `dialogs` - The dialogs, opened with Quasar's `Dialog` plugin
- `enums` - The enum files
- `hooks` - Vue Query hooks wrapping the queries and mutations
- `layouts` - The layouts in which the pages are rendered
- `pages` - The pages. Each page has its own route.
- `router` - The router configuration
- `services` - The functions & classes used repeatedly in the application
    - `auth.ts` - Authentication functions
    - `date-formating.ts` - Date formatting: Date to String and String to Date
    - `general-formatting.ts` - Formatting helpers, e.g. bytes to a human readable size
    - `queries/` - Functions calling the API to get data (GET), one file per resource
    - `mutations/` - Functions calling the API to change data (POST, PUT, DELETE), one file per resource
    - `decoding-strategies/` - Reading MCAP, ROS 1 bag and db3 files in the browser for the previews
- `types` - The TypeScript types / classes
- `utils` - Small helpers
- `environment.ts` - Wrapper for the environment variables

## Development

Use ESLint and Prettier to format the code. The code should be formatted before committing. The code should be
linted before pushing. The code should be tested before merging.
