import { RouteRecordRaw } from 'vue-router';
import MainLayout from 'layouts/MainLayout.vue';
import AccessGroupPage from 'pages/AccessGroupPage.vue';

/**
 * This file defines the routes available within the application
 */

// All routes available within the application
const ROUTES = {
    LOGIN: {
        name: 'Login',
        path: '/login',
        component: () => import('layouts/NoTopNavLayout.vue'),
        children: [
            {
                name: 'LoginPage',
                path: '',
                component: () => import('pages/LoginPage.vue'),
            },
        ],
    },

    HOME: {
        name: 'Home',
        path: '/',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'IndexPage',
                path: '',
                component: () => import('pages/IndexPage.vue'),
            },
        ],
    },

    DATATABLE: {
        name: 'DataTable',
        path: '/datatable',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'DataTablePage',
                path: '',
                component: () => import('pages/DataTablePage.vue'),
            },
        ],
    },
    UPLOAD: {
        name: 'Upload',
        path: '/upload',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'UploadPage',
                path: '',
                component: () => import('pages/UploadPage.vue'),
            },
        ],
    },
    FILE: {
        name: 'File',
        path: '/file',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'FileInfo',
                path: '',
                component: () => import('pages/FileInfo.vue'),
            },
        ],
    },
    ACTION: {
        name: 'Action',
        path: '/action',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'ActionPage',
                path: '',
                component: () => import('pages/ActionPage.vue'),
            },
        ],
    },
    ANALYSIS_DETAILS: {
        name: 'AnalysisDetails',
        path: '/action/:id',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'ActionDetailsPage',
                path: '',
                component: () => import('pages/ActionDetailsPage.vue'),
            },
        ],
    },

    LANDING: {
        name: 'Landing',
        path: '/landing',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'LandingPage',
                path: '',
                component: () => import('pages/LandingPage.vue'),
            },
        ],
    },

    EXPLORER: {
        name: 'Explorer',
        path: '/explorer',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'ExplorerPage2',
                path: '',
                component: () => import('pages/ExplorerPage.vue'),
            },
        ],
    },

    ERROR_404: {
        name: 'Error404',
        path: '/:catchAll(.*)',
        component: () => import('layouts/NoTopNavLayout.vue'),
        children: [
            {
                name: 'Error404Page',
                path: '',
                component: () => import('pages/Error404Page.vue'),
            },
        ],
    },

    USER_PROFILE: {
        name: 'UserProfile',
        path: '/user-profile',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'UserProfilePage',
                path: '',
                component: () => import('pages/UserProfilePage.vue'),
            },
        ],
    },
    ACCESS_GROUPS: {
        name: 'AccessGroups',
        path: '/access-groups',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
                name: 'AccessGroupsPage',
                path: '',
                component: () => import('pages/AccessGroupsPage.vue'),
            },
        ],
    },
    ACCESS_GROUP: {
        name: 'AccessGroupDetails',
        path: '/access-group/:uuid',
        component: () => MainLayout,
        children: [
            {
                name: 'AccessGroupDetailPage',
                path: '',
                component: () => AccessGroupPage,
            },
        ],
    },
};

// Routes that can be accessed without being logged in
export const PUBLIC_ROUTES: RouteRecordRaw[] = [
    ROUTES.LOGIN,
    ROUTES.HOME,
    ROUTES.ERROR_404,
];

export default ROUTES;
