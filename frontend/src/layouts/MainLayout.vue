<template>
    <q-layout
        view="lHh lpr lFf"
        style="position: absolute"
        class="transparent-on-open-dialog"
    >
        <header-component />

        <q-page-container>
            <navigation-bread-crumbs />
            <dev-instance-warning />

            <main>
                <router-view />
            </main>
        </q-page-container>

        <FooterComponent />
    </q-layout>
</template>

<script setup lang="ts">
import FooterComponent from 'components/FooterComponent.vue';
import HeaderComponent from 'components/HeaderComponent.vue';
import NavigationBreadCrumbs from 'components/BreadCrumbs.vue';
import DevInstanceWarning from 'components/DevInstanceWarning.vue';
</script>
