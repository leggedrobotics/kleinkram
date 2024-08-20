import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ROUTES, { PageBreadCrumb } from 'src/router/routes';

/**
 * Returns the breadcrumbs for the current route.
 * The breadcrumbs are defined in the routes.ts file.
 *
 * If the route is not found in the routes.ts file,
 * or if the route does not have breadcrumbs defined,
 * an empty array is returned.
 *
 */
export const useCrumbs = () => {
    const route = useRoute();
    return computed(() => {
        // remove the 'Page' postfix from the route name
        // to find the layout definition in the routes.ts file
        const nameWithoutPostfix = (route.name as string).replace(/Page$/, '');
        const routeDefinition = Object.values(ROUTES).find(
            (r) => r.name === nameWithoutPostfix,
        );
        return (
            routeDefinition ? routeDefinition.breadcrumbs : []
        ) as PageBreadCrumb[];
    });
};
