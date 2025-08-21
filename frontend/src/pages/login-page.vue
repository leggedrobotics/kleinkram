<template>
    <div class="flex flex-center bg-grey-2" style="height: calc(100vh - 50px)">
        <div
            style="
                border-radius: 0;
                display: grid;
                grid-template-columns: 48px 460px 48px;
                grid-template-rows: 48px 460px 48px;
            "
        >
            <div
                style="
                    border-bottom: 1px solid #e0e0e0;
                    border-right: 1px solid #e0e0e0;
                "
            />
            <div style="border-bottom: 1px solid #e0e0e0" />
            <div
                style="
                    border-bottom: 1px solid #e0e0e0;
                    border-left: 1px solid #e0e0e0;
                "
            />

            <div style="border-right: 1px solid #e0e0e0" />
            <div
                style="
                    background: white;
                    display: flex;
                    padding: 48px;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                "
            >
                <div style="width: 100%">
                    <img
                        src="/logoRSL.png"
                        style="height: 28px; margin-bottom: 48px"
                    />

                    <h1
                        style="
                            font-size: 28px;
                            font-weight: 400;
                            margin-bottom: 48px;
                            margin-top: 0;
                            line-height: 36px;
                        "
                    >
                        Login to Kleinkram
                    </h1>

                    <template v-if="useFakeOauth">
                        <q-btn
                            class="button-border full-width"
                            flat
                            outline
                            size="md"
                            label="Dev Login (Fake OAuth)"
                            @click="loginWithFakeOAuth"
                        />
                    </template>

                    <template v-if="!useFakeOauth">
                        <q-btn
                            class="button-border full-width"
                            flat
                            outline
                            size="md"
                            label="Login with Google"
                            @click="loginWithGoogle"
                        />

                        <q-btn
                            class="button-border full-width q-mt-md"
                            flat
                            outline
                            size="md"
                            label="Login with GitHub"
                            @click="loginWithGitHub"
                        />
                    </template>

                    <div v-if="$route.query.error_msg" class="q-mt-lg">
                        <span class="text-negative">{{
                            $route.query.error_msg
                        }}</span>
                    </div>
                </div>
            </div>
            <div style="border-left: 1px solid #e0e0e0" />

            <div
                style="
                    border-top: 1px solid #e0e0e0;
                    border-right: 1px solid #e0e0e0;
                "
            />
            <div style="border-top: 1px solid #e0e0e0" />
            <div
                style="
                    border-top: 1px solid #e0e0e0;
                    border-left: 1px solid #e0e0e0;
                "
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { login } from 'src/services/auth';
import { getMe } from 'src/services/queries/user';
import { watch } from 'vue';
import { useRouter } from 'vue-router';

const $router = useRouter();

const useFakeOauth =
    import.meta.env.VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT === 'true';

const { data: me, error } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 100,
    refetchInterval: 5000,
});

const loginWithGoogle = (): void => {
    login('google');
};
const loginWithGitHub = (): void => {
    login('github');
};

const loginWithFakeOAuth = (): void => {
    login('fake-oauth');
};

watch(
    [me, error],
    async ([_me, _error]) => {
        if (!!_me?.uuid && !_error) {
            await $router.push('/');
        }
    },
    { immediate: true },
);
</script>
