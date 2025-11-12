import { RouteRecordRaw } from 'vue-router';
import { routeWithLayout } from './routes-utilities';

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
        component: () => import('pages/dashboard-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    LOGIN: routeWithLayout({
        name: 'LoginPage',
        path: '/login',
        component: () => import('pages/login-page.vue'),
        layout: () => import('layouts/no-top-nav-layout.vue'),
    }),

    DATATABLE: routeWithLayout({
        name: 'DataTablePage',
        path: '/datatable',
        breadcrumbs: [{ displayName: 'All Data', to: undefined }],
        component: () => import('pages/data-table-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    UPLOAD: routeWithLayout({
        name: 'UploadPage',
        path: '/upload',
        breadcrumbs: [{ displayName: 'All Uploads', to: undefined }],
        component: () => import('pages/upload-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    ACTION: routeWithLayout({
        name: 'ActionPage',
        path: '/actions',
        breadcrumbs: [
            { displayName: 'All Actions', to: '/actions' },
            {
                displayName: ':project_name',
                to: '/project/:projectUuid/missions',
            },
            {
                displayName: ':mission_name',
                to: '/project/:projectUuid/mission/:missionUuid/files',
            },
        ],
        component: () => import('pages/action-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    ANALYSIS_DETAILS: routeWithLayout({
        name: 'AnalysisDetailsPage',
        path: '/action/:id',
        breadcrumbs: [
            { displayName: 'All Actions', to: '/actions' },
            { displayName: 'Action Details', to: undefined },
        ],
        component: () => import('pages/action-details-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    LANDING: routeWithLayout({
        name: 'LandingPage',
        path: '/landing',
        component: () => import('pages/landing-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    PROJECTS: routeWithLayout({
        name: 'ProjectsPage',
        path: '/projects',
        breadcrumbs: [{ displayName: 'All Projects', to: '/projects' }],
        component: () => import('pages/projects-explorer-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    MISSIONS: routeWithLayout({
        name: 'MissionsPage',
        breadcrumbs: [
            { displayName: 'All Projects', to: '/projects' },
            { displayName: ':project_name', to: undefined },
        ],
        path: '/project/:projectUuid/missions',
        component: () => import('pages/missions-explorer-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    FILES: routeWithLayout({
        name: 'FilesPage',
        breadcrumbs: [
            { displayName: 'All Projects', to: '/projects' },
            {
                displayName: ':project_name',
                to: '/project/:projectUuid/missions',
            },
            { displayName: ':mission_name', to: undefined },
        ],
        path: '/project/:projectUuid/mission/:missionUuid/files',
        component: () => import('pages/files-explorer-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    FILE: routeWithLayout({
        name: 'FilePage',
        breadcrumbs: [
            { displayName: 'All Projects', to: '/projects' },
            {
                displayName: ':project_name',
                to: '/project/:projectUuid/missions',
            },
            {
                displayName: ':mission_name',
                to: '/project/:projectUuid/mission/:missionUuid/files',
            },
            { displayName: ':file_name', to: undefined },
        ],
        path: '/project/:projectUuid/mission/:missionUuid/file/:file_uuid',
        component: () => import('pages/file-info-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    ERROR_404: routeWithLayout({
        name: 'Error404Page',
        path: '/:catchAll(.*)',
        component: () => import('pages/error-404-page.vue'),
        layout: () => import('layouts/no-top-nav-layout.vue'),
    }),

    ERROR_403: routeWithLayout({
        name: 'Error403Page',
        path: '/error-403',
        component: () => import('pages/error-403-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    USER_PROFILE: routeWithLayout({
        name: 'UserProfilePage',
        path: '/user-profile',
        breadcrumbs: [{ displayName: 'Profile', to: undefined }],
        component: () => import('pages/user-profile-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    ACCESS_GROUPS: routeWithLayout({
        breadcrumbs: [
            { displayName: 'All Access Groups', to: '/access-groups' },
        ],
        name: 'AccessGroupsPage',
        path: '/access-groups',
        component: () => import('pages/access-groups-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
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
        component: () => import('pages/access-group-details-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),

    HOME: routeWithLayout({
        name: 'HomePage',
        path: '/',
        component: () => import('pages/index-page.vue'),
        layout: () => import('layouts/main-layout/main-layout.vue'),
    }),
};

// Routes that can be accessed without being logged in
export const PUBLIC_ROUTES: RouteRecordRaw[] = [
    ROUTES.LOGIN,
    ROUTES.HOME,
    ROUTES.ERROR_404,
    ROUTES.ERROR_403,
];

// check if all routes have unique names
const routeNames = Object.values(ROUTES).map((route) => route.name);
if (new Set(routeNames).size !== routeNames.length) {
    throw new Error('Route names must be unique');
}

export default ROUTES;
