import {RouteRecordRaw} from 'vue-router';

import ROLE from 'src/enum/USER_ROLES';

/**
 * This file defines the routes available within the application
 */

// All routes available within the application
const ROUTES: Record<string, RouteRecordRaw> = {
  HOME: {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{path: '', component: () => import('pages/IndexPage.vue')}],
  },

  DATATABLE: {
    path: '/datatable',
    component: () => import('layouts/MainLayout.vue'),
    children: [{path: '', component: () => import('pages/DataTablePage.vue')}],
  },
  UPLOAD: {
    path: '/upload',
    component: () => import('layouts/MainLayout.vue'),
    children: [{path: '', component: () => import('pages/UploadPage.vue')}],
  },
  RUN: {
    path: '/file',
    component: () => import('layouts/MainLayout.vue'),
    children: [{path: '', component: () => import('pages/FileInfo.vue')}],
  },
  ANALYSIS: {
    path: '/analysis',
    component: () => import('layouts/MainLayout.vue'),
    children: [{path: '', component: () => import('pages/AnalysisPage.vue')}],
  },
};

// Routes that can be accessed without being logged in
export const PUBLIC_ROUTES: RouteRecordRaw[] = [
  ROUTES.LOGIN,
  ROUTES.HOME,
  ROUTES.DATATABLE,
  ROUTES.UPLOAD,
  ROUTES.WILDCARD,
  ROUTES.RUN,
];

// Type for constrained route
type ConstrainedRoute = {
  path: string; // URL path
  allowedRoles: string[]; // Roles that are allowed to access the path
};

/*
 * Routes that have additional access constraints
 * allowedRoles specifies roles that don't have to fulfill constraints to access these pages,
 * constrainedRoles must provide the specified query parameters to access the page
 * TODO Application specific: Add routes here
 */

export const CONSTRAINED_ROUTES: ConstrainedRoute[] = [
  {path: '/users', allowedRoles: [ROLE.ADMIN]},
  {path: '/files', allowedRoles: [ROLE.ADMIN, ROLE.USER]},
];

export default ROUTES;
