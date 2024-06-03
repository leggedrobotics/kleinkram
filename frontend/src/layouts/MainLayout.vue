<template>
    <q-layout view="lHh Lpr lFf">
        <q-header
            class="bg-white text-grey-8 q-py-xs"
            height-hint="58"
            bordered
            style="padding-top: unset"
        >
            <div class="row">
                <div class="col-8" style="padding-left: 10%">
                    <h1
                        v-if="$q.screen.gt.xs"
                        class="text-weight-bold"
                        style="margin: 0"
                    >
                        Bagistry
                    </h1>
                    <h1 v-else class="text-weight-bold" style="font-size: 60px">
                        Bagistry
                    </h1>
                    <h4 v-if="$q.screen.gt.xs" style="margin: 0">
                        A structured bag & mcap storage solution
                    </h4>
                </div>
                <div class="col-4">
                    <div style="max-height: 140px; height: 100%">
                        <q-img
                            src="/rsl.png"
                            fit="contain"
                            style="max-height: 100%"
                        />
                    </div>
                </div>
            </div>
            <div class="row">
                <q-toolbar>
                    <q-btn flat no-caps no-wrap icon="home" @click="goHome">
                        Home
                    </q-btn>
                    <q-btn
                        flat
                        no-caps
                        no-wrap
                        class="q-ml-xs"
                        icon="table_chart"
                        @click="goDatatable"
                    >
                        Dataviewer
                    </q-btn>
                    <q-btn
                        flat
                        no-caps
                        no-wrap
                        class="q-ml-xs"
                        icon="account_tree"
                        @click="goExplorer"
                    >
                        Explorer
                    </q-btn>
                    <q-btn
                        flat
                        no-caps
                        no-wrap
                        class="q-ml-xs"
                        icon="cloud_upload"
                        @click="goUpload"
                    >
                        Upload data
                    </q-btn>
                    <q-btn
                        flat
                        no-caps
                        no-wrap
                        class="q-ml-xs"
                        icon="analytics"
                        @click="goAnalysis"
                    >
                        Actions
                    </q-btn>
                    <q-space />
                    <q-btn
                        v-if="!loggedIn"
                        icon="login"
                        flat
                        no-caps
                        no-wrap
                        class="q-ml-xs"
                        @click="login"
                        >Login
                    </q-btn>
                    <q-btn
                        v-else
                        icon="logout"
                        flat
                        no-caps
                        no-wrap
                        class="q-ml-xs"
                        @click="logout()"
                        >Logout
                    </q-btn>
                </q-toolbar>
            </div>
        </q-header>
        <q-page-container>
            <router-view />
        </q-page-container>
        <q-banner
            class="text-white bg-red fixed-bottom"
            style="min-height: 10px"
        >
            <div class="flex flex-center text-center">
                Data will be reset without notice! <br />
                Build: {{ BUILD_INFO.version }} ({{
                    new Date(BUILD_INFO.timestamp).toLocaleString()
                }}) - {{ BUILD_INFO.git.branch }} -
                {{ BUILD_INFO.git.hash }}
            </div>
        </q-banner>
    </q-layout>
</template>

<script setup lang="ts">
import ROUTES from 'src/router/routes';
import { inject } from 'vue';
import RouterService from 'src/services/routerService';
import ENV from 'src/env';
import { isLoggedIn, loggedIn, logout } from 'src/services/auth';

import BUILD_INFO from 'src/build.ts';

const $routerService: RouterService | undefined = inject('$routerService');

function goHome(): void {
    void $routerService?.routeTo(ROUTES.HOME);
}

function goDatatable(): void {
    void $routerService?.routeTo(ROUTES.DATATABLE);
}

function goExplorer(): void {
    void $routerService?.routeTo(ROUTES.EXPLORER);
}

function goUpload(): void {
    void $routerService?.routeTo(ROUTES.UPLOAD);
}

function login(): void {
    window.location.href = `${ENV.ENDPOINT}/auth/google`;
}

function goAnalysis(): void {
    void $routerService?.routeTo(ROUTES.ANALYSIS);
}

loggedIn.value = isLoggedIn();
</script>
<style>
.fixed-bottom {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999; /* Ensure it stays on top of other content */
}
</style>
