<template>
    <q-header class="bg-default text-grey-8 q-px-lg">
        <q-toolbar class="q-pa-none height-xxl">
            <q-toolbar-title shrink class="q-pa-none" @click="backToHome">
                <KleinkramLogo class="q-pr-lg" />
            </q-toolbar-title>

            <q-separator vertical />

            <HeaderTabs :main-menu="mainMenu" class="q-ml-lg" />

            <q-space />
            <Suspense>
                <HeaderRightMenu />
            </Suspense>
        </q-toolbar>
        <breadcrumb-navigation />
    </q-header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import HeaderRightMenu from './HeaderMenuRight.vue';
import BreadcrumbNavigation from 'components/BreadCrumbs.vue';
import HeaderTabs from './HeaderTabs.vue';
import KleinkramLogo from './KleinkramLogo.vue';

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

const backToHome = async (): Promise<void> => {
    await $router.push('/');
};
</script>
