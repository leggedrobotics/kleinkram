/**
 * Represents a single breadcrumb in the application.
 * The `to` field is optional, and if it is not defined,
 * the breadcrumb is not clickable.
 *
 * The last breadcrumb in an array of breadcrumbs is
 * always not clickable.
 *
 */
export interface PageBreadCrumb {
    displayName: string;
    to: string | undefined;
    name?: string;
}

/**
 * Helper function to create a route with a layout.
 */
export const routeWithLayout = (component: {
    name: string;
    path: string;
    breadcrumbs?: PageBreadCrumb[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: () => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layout: () => any;
}) => {
    return {
        name: `${component.name}Layout`,
        path: component.path,
        routeName: component.name,
        breadcrumbs: component.breadcrumbs,
        component: component.layout,
        children: [
            {
                name: component.name,
                path: '',
                component: component.component,
            },
        ],
    };
};
