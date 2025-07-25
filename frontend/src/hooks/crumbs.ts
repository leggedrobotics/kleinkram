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
        const routeDefinition = Object.values(ROUTES).find(
            (r) => r.name === nameWithPostfix,
        );
        return routeDefinition?.breadcrumbs === undefined
            ? []
            : routeDefinition.breadcrumbs;
    });
};
