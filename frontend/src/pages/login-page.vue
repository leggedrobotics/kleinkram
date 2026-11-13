<template>
    <auth-frame>
        <div style="width: 100%">
            <img src="/logoRSL.png" class="login-logo" />

            <h1 class="login-title">Login to Kleinkram</h1>

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
                    The authentication backend is currently unavailable. Please
                    try again later or contact your system administrator.
                </div>
                <q-btn
                    label="Retry Connection"
                    color="warning"
                    flat
                    class="q-mt-sm full-width login-button"
                    @click="handleRefetchProviders"
                />
            </div>

            <!-- OAuth buttons -->
            <template v-else>
                <template v-if="availableProviders?.fakeOauth">
                    <q-btn
                        class="button-border full-width login-button"
                        flat
                        outline
                        size="md"
                        label="Dev Login (Fake OAuth)"
                        @click="loginWithFakeOAuth"
                    />
                </template>

                <q-btn
                    v-if="availableProviders?.google"
                    class="button-border full-width login-button"
                    flat
                    outline
                    size="md"
                    label="Login with Google"
                    @click="loginWithGoogle"
                />

                <q-btn
                    v-if="availableProviders?.github"
                    class="button-border full-width q-mt-md login-button"
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
    </auth-frame>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import AuthFrame from 'components/common/auth-frame.vue';
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

const handleRefetchProviders = () => {
    void refetchProviders();
};
</script>

<style scoped>
.login-logo {
    height: 28px;
    margin-bottom: 48px;
    max-width: 100%;
}

.login-title {
    font-size: 28px;
    font-weight: 400;
    line-height: 36px;
    margin-bottom: 48px;
    margin-top: 0;
}

/* Comfortable touch targets on touch-sized viewports */
@media (max-width: 1023px) {
    .login-button {
        min-height: 44px;
    }
}

@media (max-width: 599px) {
    .login-logo {
        margin-bottom: 32px;
    }

    .login-title {
        font-size: 24px;
        line-height: 32px;
        margin-bottom: 32px;
    }
}
</style>
