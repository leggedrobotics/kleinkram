import { RouteRecordRaw } from 'vue-router';

/**
 * Represents a single breadcrumb in the application.
 * The `to` field is optional, and if it is not defined,
 * the breadcrumb is not clickable.
 *
 * The last breadcrumb in an array of breadcrumbs is
 * always not clickable.
 *
 */
export type PageBreadCrumb = {
    displayName: string;
    to: string | undefined;
};

/**
 * Helper function to create a route with a layout.
 */
const routeWithLayout = (component: {
    name: string;
    path: string;
    breadcrumbs?: PageBreadCrumb[];
    component: () => Promise<typeof import('*.vue')>;
    layout: () => Promise<typeof import('*.vue')>;
}) => {
    return {
        name: component.name,
        path: component.path,
        breadcrumbs: component.breadcrumbs,
        component: component.layout,
        children: [
            {
                name: component.name + 'Page',
                path: '',
                component: component.component,
            },
        ],
    };
};

/**
 *
 * Defines all the routes in the application.
 *
 * The name must be unique among all routes,
 * as we use it to identify the route in the application.
 *
 */
const ROUTES = {
    LOGIN: routeWithLayout({
        name: 'Login',
        path: '/login',
        component: () => import('pages/LoginPage.vue'),
        layout: () => import('layouts/NoTopNavLayout.vue'),
    }),

    HOME: routeWithLayout({
        name: 'Home',
        path: '/',
        component: () => import('pages/IndexPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    DATATABLE: routeWithLayout({
        name: 'DataTable',
        path: '/datatable',
        component: () => import('pages/DataTablePage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    UPLOAD: routeWithLayout({
        name: 'Upload',
        path: '/upload',
        component: () => import('pages/UploadPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ACTION: routeWithLayout({
        name: 'Action',
        path: '/action',
        component: () => import('pages/ActionPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ANALYSIS_DETAILS: routeWithLayout({
        name: 'AnalysisDetails',
        path: '/action/:id',
        component: () => import('pages/ActionDetailsPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    LANDING: routeWithLayout({
        name: 'Landing',
        path: '/landing',
        component: () => import('pages/LandingPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    PROJECTS: routeWithLayout({
        name: 'Projects',
        path: '/projects',
        breadcrumbs: [{ displayName: 'Projects', to: '/projects' }],
        component: () => import('pages/ProjectsExplorer.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    MISSIONS: routeWithLayout({
        name: 'Missions',
        breadcrumbs: [
            { displayName: 'Projects', to: '/projects' },
            { displayName: 'project_name_placeholder', to: undefined },
        ],
        path: '/projects/:project_uuid/missions',
        component: () => import('pages/MissionsExplorer.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    FILES: routeWithLayout({
        name: 'Files',
        breadcrumbs: [
            { displayName: 'Projects', to: '/projects' },
            { displayName: 'project_name_placeholder', to: '/projects' },
            { displayName: 'mission_name_placeholder', to: undefined },
        ],
        path: '/projects/:project_uuid/missions/:mission_uuid/files',
        component: () => import('pages/FilesExplorer.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    FILE: routeWithLayout({
        name: 'File',
        breadcrumbs: [
            { displayName: 'Projects', to: '/projects' },
            { displayName: 'project_name_placeholder', to: '/projects' },
            { displayName: 'mission_name_placeholder', to: '/projects' },
            { displayName: 'file_name_placeholder', to: undefined },
        ],
        path: '/projects/:project_uuid/missions/:mission_uuid/files/:file_uuid',
        component: () => import('pages/FileInfo.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ERROR_404: routeWithLayout({
        name: 'Error404',
        path: '/:catchAll(.*)',
        component: () => import('pages/Error404Page.vue'),
        layout: () => import('layouts/NoTopNavLayout.vue'),
    }),

    USER_PROFILE: routeWithLayout({
        name: 'UserProfile',
        path: '/user-profile',
        breadcrumbs: [{ displayName: 'User Profile', to: undefined }],
        component: () => import('pages/UserProfilePage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ACCESS_GROUPS: routeWithLayout({
        breadcrumbs: [
            { displayName: 'All Access Groups', to: '/access-groups' },
        ],
        name: 'AccessGroups',
        path: '/access-groups',
        component: () => import('pages/AccessGroupsPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ACCESS_GROUP: routeWithLayout({
        breadcrumbs: [
            { displayName: 'All Access Groups', to: '/access-groups' },
            {
                displayName: 'access_group_name_placeholder',
                to: undefined,
            },
        ],
        name: 'AccessGroupDetail',
        path: '/access-group/:uuid',
        component: () => import('pages/AccessGroupPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),
};

// check if all routes have unique names
const routeNames = Object.values(ROUTES).map((route) => route.name);
if (new Set(routeNames).size !== routeNames.length) {
    throw new Error('Route names must be unique');
}

// Routes that can be accessed without being logged in
export const PUBLIC_ROUTES: RouteRecordRaw[] = [
    ROUTES.LOGIN,
    ROUTES.HOME,
    ROUTES.ERROR_404,
];

export default ROUTES;
