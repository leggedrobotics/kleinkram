<template>
    <q-header bordered class="bg-default text-grey-8 height-xxl q-px-lg">
        <q-toolbar class="q-pa-none height-xxl">
            <div>
                <q-btn
                    flat
                    dense
                    round
                    icon="sym_o_menu"
                    v-show="$q.screen.lt.lg"
                >
                    <q-menu auto-close style="width: 280px">
                        <q-list>
                            <q-item
                                v-for="item in main_menu"
                                :key="item.title"
                                clickable
                                :to="item.to"
                            >
                                <q-item-section avatar>
                                    <q-icon
                                        :name="item.icon"
                                        style="font-weight: bold"
                                    />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label
                                        >{{ item.title }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </div>

            <q-toolbar-title
                shrink
                @click="$router.push('/')"
                class="q-pa-none"
            >
                <kleinkram-logo class="q-pr-lg" />
            </q-toolbar-title>

            <q-separator vertical />

            <header-tabs
                v-show="$q.screen.gt.md"
                :main_menu="main_menu"
                class="q-ml-lg"
            />

            <q-space />
            <Suspense>
                <header-menu-right />
            </Suspense>
        </q-toolbar>
    </q-header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import KleinkramLogo from 'components/header/KleinkramLogo.vue';
import HeaderTabs from 'components/header/HeaderTabs.vue';
import HeaderMenuRight from 'components/HeaderMenuRight.vue';

const $router = useRouter();

const main_menu = [
    { title: 'Dashboard', icon: 'sym_o_dashboard', to: '' },
    { title: 'Projects', icon: 'sym_o_box', to: ROUTES.PROJECTS.path },
    {
        title: 'Datatable',
        icon: 'sym_o_database',
        to: ROUTES.DATATABLE.path,
    },
    { title: 'Upload', icon: 'sym_o_upload', to: ROUTES.UPLOAD.path },
    { title: 'Actions', icon: 'sym_o_analytics', to: ROUTES.ACTION.path },
    {
        title: 'Access Groups',
        icon: 'sym_o_lock',
        to: ROUTES.ACCESS_GROUPS.path,
    },
];
</script>
