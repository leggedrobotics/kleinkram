<template>
    <q-page class="flex flex-center bg-grey-2">
        <q-card class="q-pa-md shadow-2 my_card" bordered>
            <q-card-section class="text-center">
                <div class="text-grey-9 text-h5 text-weight-bold">
                    Sign in to Kleinkram
                </div>
                <div class="text-grey-8">Sign in below to access your data</div>
            </q-card-section>

            <q-card-section>
                <q-btn
                    style="border-radius: 8px"
                    color="dark"
                    rounded
                    size="md"
                    label="Sign in with Google"
                    class="full-width"
                    @click="login()"
                />
            </q-card-section>

            <q-card-section
                class="text-center"
                v-if="error_state === 'auth_flow_failed'"
            >
                <div class="text-red text-weight-bold">{{ error_msg }}</div>
            </q-card-section>

            <q-card-section class="text-center q-pt-none">
                <div class="text-grey-8">
                    Don't want to sign in?
                    <a
                        href="/"
                        class="text-dark text-weight-bold"
                        style="text-decoration: none"
                        >Back to Home.</a
                    >
                </div>
            </q-card-section>
        </q-card>
    </q-page>
</template>

<script setup lang="ts">
import { login } from 'src/services/auth';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { getMe } from 'src/services/queries/user';
import { watch } from 'vue';

const $route = useRoute();
const $router = useRouter();
const { error_msg, error_state } = $route.query;

const { data: me, error } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 100,
    refetchInterval: 5000,
});

watch(
    [me, error],
    ([me, error]) => {
        if (!!me?.uuid && !error) {
            $router.push('/');
        }
    },
    { immediate: true },
);
</script>
