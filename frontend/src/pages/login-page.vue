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

                    <!-- Loading state -->
                    <div
                        v-if="isLoadingProviders"
                        class="q-mb-md"
                        style="display: flex; justify-content: center"
                    >
                        <q-spinner color="primary" size="48px" />
                    </div>

                    <!-- Backend unavailable warning -->
                    <div
                        v-else-if="isProvidersError || noProvidersAvailable"
                        class="q-mb-md q-pa-md"
                        style="
                            background-color: #fff3cd;
                            border: 1px solid #ffc107;
                            border-radius: 4px;
                            color: #856404;
                        "
                    >
                        <div style="font-weight: 500; margin-bottom: 8px">
                            Backend Unavailable
                        </div>
                        <div style="font-size: 14px">
                            The authentication backend is currently unavailable.
                            Please try again later or contact your system
                            administrator.
                        </div>
                        <q-btn
                            label="Retry Connection"
                            color="warning"
                            flat
                            class="q-mt-sm full-width"
                            @click="() => refetchProviders()"
                        />
                    </div>

                    <!-- OAuth buttons -->
                    <template v-else>
                        <template v-if="availableProviders?.fakeOauth">
                            <q-btn
                                class="button-border full-width"
                                flat
                                outline
                                size="md"
                                label="Dev Login (Fake OAuth)"
                                @click="loginWithFakeOAuth"
                            />
                        </template>

                        <q-btn
                            v-if="availableProviders?.google"
                            class="button-border full-width"
                            flat
                            outline
                            size="md"
                            label="Login with Google"
                            @click="loginWithGoogle"
                        />

                        <q-btn
                            v-if="availableProviders?.github"
                            class="button-border full-width q-mt-md"
                            flat
                            outline
                            size="md"
                            label="Login with GitHub"
                            @click="loginWithGitHub"
                        />
                    </template>

                    <div v-if="$route.query.error_msg" class="q-mt-lg">
                        <span class="text-negative">
                            {{ $route.query.error_msg }}
                        </span>
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
import { getAvailableProviders, login } from 'src/services/auth';
import { getMe } from 'src/services/queries/user';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const $router = useRouter();

const {
    data: availableProviders,
    isLoading: isLoadingProviders,
    isError: isProvidersError,
    refetch: refetchProviders,
} = useQuery({
    queryKey: ['available-providers'],
    queryFn: getAvailableProviders,
    staleTime: Infinity,
    retry: false,
    refetchInterval: (query) => (query.state.error ? 5000 : false),
});

const { data: me, error } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 100,
    refetchInterval: 5000,
});

const noProvidersAvailable = computed(() => {
    if (!availableProviders.value) return false;
    return (
        !availableProviders.value.google &&
        !availableProviders.value.github &&
        !availableProviders.value.fakeOauth
    );
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
