<template>
    <q-header bordered class="bg-white text-grey-9">
        <q-toolbar>

            <q-btn flat round dense icon="menu" />

            <q-toolbar-title shrink>
                Bagistry
            </q-toolbar-title>

            <q-tabs>
                <q-route-tab :to="ROUTES.HOME.path"> Home</q-route-tab>
                <q-route-tab :to="ROUTES.DATATABLE.path"> Datatable</q-route-tab>
                <q-route-tab :to="ROUTES.EXPLORER.path"> Explorer</q-route-tab>
                <q-route-tab :to="ROUTES.UPLOAD.path"> Upload</q-route-tab>
                <q-route-tab :to="ROUTES.ACTION.path"> Analysis</q-route-tab>
            </q-tabs>

            <q-space />

            <q-tabs>
                <q-route-tab :to="ROUTES.LOGIN.path"> Sign In</q-route-tab>
                <q-tab @click="logout">Sign out</q-tab>
            </q-tabs>


        </q-toolbar>
    </q-header>
</template>

<script setup lang="ts">
import ROUTES from 'src/router/routes';
import { logout } from 'src/services/auth';
</script>