import { RouteRecordRaw } from 'vue-router';
import { routeWithLayout } from 'src/router/routesUtils';

/**
 *
 * Defines all the routes in the application.
 *
 * The name must be unique among all routes,
 * as we use it to identify the route in the application.
 *
 */
const ROUTES = {
    DASHBOARD: routeWithLayout({
        name: 'DashboardPage',
        path: '/dashboard',
        component: () => import('pages/DashboardPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    LOGIN: routeWithLayout({
        name: 'LoginPage',
        path: '/login',
        component: () => import('pages/LoginPage.vue'),
        layout: () => import('layouts/NoTopNavLayout.vue'),
    }),

    HOME: routeWithLayout({
        name: 'HomePage',
        path: '/',
        component: () => import('pages/IndexPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    DATATABLE: routeWithLayout({
        name: 'DataTablePage',
        path: '/datatable',
        breadcrumbs: [{ displayName: 'All Data', to: undefined }],
        component: () => import('pages/DataTablePage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    UPLOAD: routeWithLayout({
        name: 'UploadPage',
        path: '/upload',
        breadcrumbs: [{ displayName: 'All Uploads', to: undefined }],
        component: () => import('pages/UploadPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ACTION: routeWithLayout({
        name: 'ActionPage',
        path: '/actions',
        breadcrumbs: [{ displayName: 'All Actions', to: undefined }],
        component: () => import('pages/ActionPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ANALYSIS_DETAILS: routeWithLayout({
        name: 'AnalysisDetailsPage',
        path: '/action/:id',
        breadcrumbs: [
            { displayName: 'All Actions', to: '/actions' },
            { displayName: 'Action Details', to: undefined },
        ],
        component: () => import('pages/ActionDetailsPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    LANDING: routeWithLayout({
        name: 'LandingPage',
        path: '/landing',
        component: () => import('pages/LandingPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    PROJECTS: routeWithLayout({
        name: 'ProjectsPage',
        path: '/projects',
        breadcrumbs: [{ displayName: 'All Projects', to: '/projects' }],
        component: () => import('pages/ProjectsExplorer.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    MISSIONS: routeWithLayout({
        name: 'MissionsPage',
        breadcrumbs: [
            { displayName: 'All Projects', to: '/projects' },
            { displayName: ':project_name', to: undefined },
        ],
        path: '/project/:project_uuid/missions',
        component: () => import('pages/MissionsExplorer.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    FILES: routeWithLayout({
        name: 'FilesPage',
        breadcrumbs: [
            { displayName: 'All Projects', to: '/projects' },
            {
                displayName: ':project_name',
                to: '/project/:project_uuid/missions',
            },
            { displayName: ':mission_name', to: undefined },
        ],
        path: '/project/:project_uuid/mission/:mission_uuid/files',
        component: () => import('pages/FilesExplorer.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    FILE: routeWithLayout({
        name: 'FilePage',
        breadcrumbs: [
            { displayName: 'All Projects', to: '/projects' },
            {
                displayName: ':project_name',
                to: '/project/:project_uuid/missions',
            },
            {
                displayName: ':mission_name',
                to: '/project/:project_uuid/mission/:mission_uuid/files',
            },
            { displayName: ':file_name', to: undefined },
        ],
        path: '/project/:project_uuid/mission/:mission_uuid/file/:file_uuid',
        component: () => import('pages/FileInfo.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ERROR_404: routeWithLayout({
        name: 'Error404Page',
        path: '/:catchAll(.*)',
        component: () => import('pages/Error404Page.vue'),
        layout: () => import('layouts/NoTopNavLayout.vue'),
    }),

    USER_PROFILE: routeWithLayout({
        name: 'UserProfilePage',
        path: '/user-profile',
        breadcrumbs: [{ displayName: 'Profile', to: undefined }],
        component: () => import('pages/UserProfilePage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ACCESS_GROUPS: routeWithLayout({
        breadcrumbs: [
            { displayName: 'All Access Groups', to: '/access-groups' },
        ],
        name: 'AccessGroupsPage',
        path: '/access-groups',
        component: () => import('pages/AccessGroupsPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),

    ACCESS_GROUP: routeWithLayout({
        breadcrumbs: [
            { displayName: 'All Access Groups', to: '/access-groups' },
            {
                displayName: 'Group Details',
                to: undefined,
            },
        ],
        name: 'AccessGroupDetailPage',
        path: '/access-group/:uuid',
        component: () => import('pages/AccessGroupPage.vue'),
        layout: () => import('layouts/MainLayout.vue'),
    }),
};

// Routes that can be accessed without being logged in
export const PUBLIC_ROUTES: RouteRecordRaw[] = [
    ROUTES.LOGIN,
    ROUTES.HOME,
    ROUTES.ERROR_404,
];

// check if all routes have unique names
const routeNames = Object.values(ROUTES).map((route) => route.name);
if (new Set(routeNames).size !== routeNames.length) {
    throw new Error('Route names must be unique');
}

export default ROUTES;
