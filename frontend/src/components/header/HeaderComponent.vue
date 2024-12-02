<template>
    <q-header class="bg-default text-grey-8 q-px-lg">
        <q-toolbar class="q-pa-none height-xxl">
            <q-toolbar-title shrink class="q-pa-none" @click="backToHome">
                <kleinkram-logo class="q-pr-lg" />
            </q-toolbar-title>

            <q-separator vertical />

            <header-navigation-tabs :main_menu="mainMenu" class="q-ml-lg" />

            <q-space />
            <Suspense>
                <header-right-menu />
            </Suspense>
        </q-toolbar>
        <breadcrumb-navigation />
    </q-header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import KleinkramLogo from 'components/header/KleinkramLogo.vue';
import HeaderNavigationTabs from 'components/header/HeaderTabs.vue';
import HeaderRightMenu from 'components/header/HeaderMenuRight.vue';
import BreadcrumbNavigation from 'components/BreadCrumbs.vue';

const $router = useRouter();

const mainMenu = [
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

const backToHome = await $router.push('/');
</script>
