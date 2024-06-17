import {RouteRecordRaw} from 'vue-router';


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
            {path: '', component: () => import('pages/LoginPage.vue')},
        ],
    },

    HOME: {
        name: 'Home',
        path: '/',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {path: '', component: () => import('pages/IndexPage.vue')},
        ],
    },

    DATATABLE: {
        name: 'DataTable',
        path: '/datatable',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {path: '', component: () => import('pages/DataTablePage.vue')},
        ],
    },
    UPLOAD: {
        name: 'Upload',
        path: '/upload',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {path: '', component: () => import('pages/UploadPage.vue')},
        ],
    },
    FILE: {
        name: 'File',
        path: '/file',
        component: () => import('layouts/MainLayout.vue'),
        children: [{path: '', component: () => import('pages/FileInfo.vue')}],
    },
    ACTION: {
        name: 'Action',
        path: '/action',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {path: '', component: () => import('pages/ActionPage.vue')},
        ],
    },
    ANALYSIS_DETAILS: {
        name: 'AnalysisDetails',
        path: '/action/:id',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {
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
            {path: '', component: () => import('pages/LandingPage.vue')},
        ],
    },

    EXPLORER: {
        name: 'Explorer',
        path: '/explorer',
        component: () => import('layouts/MainLayout.vue'),
        children: [
            {path: '', component: () => import('pages/ExplorerPage.vue')},
        ],
    },

    ERROR_404: {
        name: 'Error404',
        path: '/:catchAll(.*)',
        component: () => import('layouts/NoTopNavLayout.vue'),
        children: [{path: '', component: () => import('pages/Error404Page.vue')}],
    },


};

// Routes that can be accessed without being logged in
export const PUBLIC_ROUTES: RouteRecordRaw[] = [
    ROUTES.LOGIN,
    ROUTES.HOME,
];

export default ROUTES;