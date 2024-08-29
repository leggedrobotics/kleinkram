<template>
    <q-header class="bg-default text-grey-8 q-px-lg">
        <q-toolbar class="q-pa-none height-xxl">
            <q-toolbar-title
                shrink
                @click="$router.push('/')"
                class="q-pa-none"
            >
                <kleinkram-logo class="q-pr-lg" />
            </q-toolbar-title>

            <q-separator vertical />

            <header-tabs :main_menu="main_menu" class="q-ml-lg" />

            <q-space />
            <Suspense>
                <header-menu-right />
            </Suspense>
        </q-toolbar>
        <navigation-bread-crumbs />
    </q-header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import KleinkramLogo from 'components/header/KleinkramLogo.vue';
import HeaderTabs from 'components/header/HeaderTabs.vue';
import HeaderMenuRight from 'components/HeaderMenuRight.vue';
import NavigationBreadCrumbs from 'components/BreadCrumbs.vue';

const $router = useRouter();

const main_menu = [
    {
        title: 'Dashboard',
        icon: 'sym_o_dashboard',
        to: ROUTES.DASHBOARD.path,
        subpage_names: [],
    },
    {
        title: 'Projects',
        icon: 'sym_o_box',
        to: ROUTES.PROJECTS.path,
        subpage_names: [ROUTES.FILES.name, ROUTES.MISSIONS.name],
    },
    {
        title: 'Datatable',
        icon: 'sym_o_database',
        to: ROUTES.DATATABLE.path,
        subpage_names: [],
    },
    {
        title: 'Actions',
        icon: 'sym_o_analytics',
        to: ROUTES.ACTION.path,
        subpage_names: [ROUTES.ANALYSIS_DETAILS.name],
    },
    {
        title: 'Access Groups',
        icon: 'sym_o_lock',
        to: ROUTES.ACCESS_GROUPS.path,
        subpage_names: [ROUTES.ACCESS_GROUP.name],
    },
];
</script>
