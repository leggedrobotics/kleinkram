<template>
    <div class="login-page flex flex-center bg-grey-2">
        <div class="login-frame">
            <div class="login-frame-cell login-frame-cell--top-left" />
            <div class="login-frame-cell login-frame-cell--top-center" />
            <div class="login-frame-cell login-frame-cell--top-right" />

            <div class="login-frame-cell login-frame-cell--middle-left" />
            <div class="login-card">
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
                            The authentication backend is currently unavailable.
                            Please try again later or contact your system
                            administrator.
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
            </div>
            <div class="login-frame-cell login-frame-cell--middle-right" />

            <div class="login-frame-cell login-frame-cell--bottom-left" />
            <div class="login-frame-cell login-frame-cell--bottom-center" />
            <div class="login-frame-cell login-frame-cell--bottom-right" />
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

const handleRefetchProviders = () => {
    void refetchProviders();
};
</script>

<style scoped>
/*
 * The login card sits inside a decorative 3x3 frame. On desktop the frame is
 * exactly 48px + 460px + 48px wide (unchanged); on narrow viewports the middle
 * column shrinks so the page never scrolls horizontally.
 */
.login-page {
    height: calc(100vh - 50px);
}

.login-frame {
    border-radius: 0;
    display: grid;
    grid-template-columns: 48px minmax(0, 460px) 48px;
    grid-template-rows: 48px minmax(460px, auto) 48px;
    width: 100%;
    max-width: 556px;
}

.login-frame-cell--top-left {
    border-bottom: 1px solid #e0e0e0;
    border-right: 1px solid #e0e0e0;
}

.login-frame-cell--top-center {
    border-bottom: 1px solid #e0e0e0;
}

.login-frame-cell--top-right {
    border-bottom: 1px solid #e0e0e0;
    border-left: 1px solid #e0e0e0;
}

.login-frame-cell--middle-left {
    border-right: 1px solid #e0e0e0;
}

.login-frame-cell--middle-right {
    border-left: 1px solid #e0e0e0;
}

.login-frame-cell--bottom-left {
    border-top: 1px solid #e0e0e0;
    border-right: 1px solid #e0e0e0;
}

.login-frame-cell--bottom-center {
    border-top: 1px solid #e0e0e0;
}

.login-frame-cell--bottom-right {
    border-top: 1px solid #e0e0e0;
    border-left: 1px solid #e0e0e0;
}

.login-card {
    align-items: center;
    background: white;
    display: flex;
    justify-content: center;
    padding: 48px;
    text-align: center;
}

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
    .login-page {
        height: auto;
        min-height: calc(100vh - 50px);
        padding: 24px 0;
    }

    .login-frame {
        grid-template-columns: 16px minmax(0, 1fr) 16px;
        grid-template-rows: 16px auto 16px;
    }

    .login-card {
        padding: 32px 20px;
    }

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
