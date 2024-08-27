<template>
    <q-layout
        view="lHh lpr lFf"
        style="position: absolute"
        class="transparent-on-open-dialog"
    >
        <header-component />

        <main>
            <q-page-container
                style="
                    width: auto;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                "
            >
                <div>
                    <dev-instance-warning />
                    <router-view />
                </div>
                <FooterComponent />
            </q-page-container>
        </main>
    </q-layout>
</template>

<script setup lang="ts">
import FooterComponent from 'components/FooterComponent.vue';
import HeaderComponent from 'components/HeaderComponent.vue';
import DevInstanceWarning from 'components/DevInstanceWarning.vue';
</script>
