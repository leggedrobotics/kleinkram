<template>
    <q-page class="flex flex-center bg-grey-2">
        <q-card class="q-pa-md shadow-2 my_card" bordered>
            <q-card-section class="text-center">
                <div class="text-grey-9 text-h5 text-weight-bold">Sign in to Bagistry</div>
                <div class="text-grey-8">Sign in below to access your data</div>
            </q-card-section>

            <q-card-section>
                <q-btn style="  border-radius: 8px;" color="dark" rounded size="md" label="Sign in with Google" no-caps
                       class="full-width" @click="login()"></q-btn>
            </q-card-section>

            <q-card-section class="text-center" v-if="error_state === 'auth_flow_failed'">
                <div class="text-red text-weight-bold">{{ error_msg }}</div>
            </q-card-section>

            <q-card-section class="text-center q-pt-none">
                <div class="text-grey-8">Don't want to sign in?
                    <a href="" class="text-dark text-weight-bold" style="text-decoration: none">Back to Home.</a></div>
            </q-card-section>

        </q-card>
    </q-page>
</template>

<script setup lang="ts">
import { login } from 'src/services/auth';
import { useRoute } from 'vue-router';

const $route = useRoute();
const { error_msg, error_state } = $route.query;
console.error(error_state, error_msg);

</script>