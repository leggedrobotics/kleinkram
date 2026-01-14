import ROUTES from 'src/router/routes';
import { PageBreadCrumb } from 'src/router/routes-utilities';
import { computed, ComputedRef } from 'vue';
import { useRoute } from 'vue-router';

/**
 * Returns the breadcrumbs for the current route.
 * The breadcrumbs are defined in the routes.ts file.
 *
 * If the route is not found in the routes.ts file,
 * or if the route does not have breadcrumbs defined,
 * an empty array is returned.
 *
 */
export const useCrumbs = (): ComputedRef<PageBreadCrumb[]> => {
    const route = useRoute();
    return computed(() => {
        const nameWithPostfix = `${route.name as string}Layout`;

        let routeDefinition = Object.values(ROUTES).find(
            (r) => r.name === nameWithPostfix && 'breadcrumbs' in r,
        );

        // fall back to the parent route's breadcrumbs
        if (
            (!routeDefinition || !('breadcrumbs' in routeDefinition)) &&
            'ACTION' in ROUTES &&
            'breadcrumbs' in ROUTES.ACTION
        ) {
            routeDefinition = ROUTES.ACTION;
        }

        const breadcrumbs =
            routeDefinition && 'breadcrumbs' in routeDefinition
                ? routeDefinition.breadcrumbs
                : undefined;

        return breadcrumbs ?? [];
    });
};
