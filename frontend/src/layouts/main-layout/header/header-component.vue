<template>
    <q-header class="bg-default text-grey-8 q-px-lg">
        <q-toolbar class="q-pa-none height-xxl">
            <q-toolbar-title
                shrink
                class="q-pa-none"
                @click="navigateBackToHome"
            >
                <kleinkram-logo class="q-pr-lg" />
            </q-toolbar-title>

            <q-separator vertical />

            <header-tabs :main-menu="mainMenu" class="q-ml-lg" />

            <q-space />

            <Suspense>
                <header-right-menu />
            </Suspense>
        </q-toolbar>
        <bread-crumbs-navigation />
    </q-header>
</template>

<script setup lang="ts">
import KleinkramLogo from 'src/components/images/kleinkram-logo.vue';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';
import BreadCrumbsNavigation from './bread-crumb-navigation.vue';
import HeaderRightMenu from './header-right-menu.vue';
import HeaderTabs, { MainMenu } from './header-tabs.vue';

const $router = useRouter();

const mainMenu: MainMenu[] = [
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
        to: ROUTES.ACTION.path,
        subpageNames: [ROUTES.ANALYSIS_DETAILS.name],
    },
    {
        title: 'Access Groups',
        icon: 'sym_o_lock',
        to: ROUTES.ACCESS_GROUPS.path,
        subpageNames: [ROUTES.ACCESS_GROUP.name],
    },
];

const navigateBackToHome = async (): Promise<void> => {
    await $router.push('/');
};
</script>
