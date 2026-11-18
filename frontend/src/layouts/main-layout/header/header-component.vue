<template>
    <q-header
        class="bg-default text-grey-8"
        style="padding: 0 var(--page-gutter)"
    >
        <q-toolbar class="q-pa-none height-xxl no-wrap">
            <q-toolbar-title
                shrink
                class="q-pa-none"
                @click="navigateBackToHome"
            >
                <kleinkram-logo
                    :class="$q.screen.gt.xs ? 'q-pr-lg' : 'q-pr-sm'"
                />
            </q-toolbar-title>

            <q-separator vertical />

            <header-tabs
                :main-menu="mainMenu"
                :class="$q.screen.gt.xs ? 'q-ml-lg' : 'q-ml-xs'"
            />

            <q-space />

            <Suspense>
                <header-right-menu />
            </Suspense>
        </q-toolbar>
        <bread-crumbs-navigation />
    </q-header>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import KleinkramLogo from 'src/components/images/kleinkram-logo.vue';
import { canCreateProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import BreadCrumbsNavigation from './bread-crumb-navigation.vue';
import HeaderRightMenu from './header-right-menu.vue';
import HeaderTabs from './header-tabs.vue';
import type { MainMenu } from './main-menu';

const $router = useRouter();
const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();

const baseMenu: MainMenu[] = [
    {
        title: 'Dashboard',
        icon: 'sym_o_dashboard',
        to: ROUTES.DASHBOARD.path,
        subpageNames: [],
    },
    {
        title: 'Projects',
        icon: 'sym_o_box',
        to: ROUTES.PROJECTS.path,
        subpageNames: [
            ROUTES.FILES.name,
            ROUTES.MISSIONS.name,
            ROUTES.FILE.name,
        ],
    },
    {
        title: 'Datatable',
        icon: 'sym_o_database',
        to: ROUTES.DATATABLE.path,
        subpageNames: [],
    },
    {
        title: 'Actions',
        icon: 'sym_o_analytics',
        to: '/actions',
        subpageNames: [ROUTES.ANALYSIS_DETAILS.name, ROUTES.ACTION.name],
    },
    {
        title: 'Access Control',
        icon: 'sym_o_lock',
        to: ROUTES.ACCESS_GROUPS.path,
        subpageNames: [ROUTES.ACCESS_GROUP.name],
    },
];

const systemMenu: MainMenu = {
    title: 'System',
    icon: 'sym_o_dns',
    to: ROUTES.SYSTEM.path,
    subpageNames: [],
};

// storage and workers are only visible to users who may create projects
const mainMenu = computed<MainMenu[]>(() =>
    canCreateProject(permissions.value) ? [...baseMenu, systemMenu] : baseMenu,
);

const navigateBackToHome = async (): Promise<void> => {
    await $router.push('/');
};
</script>
