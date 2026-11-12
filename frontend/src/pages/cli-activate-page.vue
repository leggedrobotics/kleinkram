<template>
    <auth-frame>
        <div class="activate">
            <img src="/logoRSL.png" class="activate-logo" alt="" />

            <!-- 1. no code yet: ask for the one from the terminal -->
            <template v-if="!userCode">
                <h1 class="activate-title">Connect the Kleinkram CLI</h1>
                <p class="activate-subtitle">{{ instanceName }}</p>

                <p class="activate-text">
                    Enter the code that <code>klein login</code> shows in your
                    terminal.
                </p>
                <form class="activate-form" @submit.prevent="submitCode">
                    <q-input
                        v-model="enteredCode"
                        outlined
                        square
                        autofocus
                        maxlength="9"
                        input-class="activate-code-input"
                        placeholder="XXXX-XXXX"
                        aria-label="Code from the terminal"
                        :error="enteredCode.length > 0 && !isCodeComplete"
                        hide-bottom-space
                        @update:model-value="formatEnteredCode"
                    />
                    <q-btn
                        flat
                        no-caps
                        label="Continue"
                        type="submit"
                        class="full-width activate-button bg-button-primary"
                        :disable="!isCodeComplete"
                    />
                </form>
            </template>

            <!-- 2. loading the login -->
            <div v-else-if="isLoading" class="activate-loading">
                <q-spinner color="link-primary" size="48px" />
            </div>

            <!-- 3. unknown or expired code -->
            <template v-else-if="isError || !authorization">
                <q-icon
                    name="sym_o_timer_off"
                    size="48px"
                    class="activate-state-icon activate-state-icon--error"
                />
                <h1 class="activate-title">Code not found</h1>
                <p class="activate-text">
                    <b>{{ userCode }}</b> is unknown or has expired. Codes are
                    valid for 10 minutes. Run <code>klein login</code> again to
                    get a new one.
                </p>
                <q-btn
                    flat
                    outline
                    no-caps
                    label="Enter another code"
                    class="full-width activate-button button-border"
                    @click="clearCode"
                />
            </template>

            <!-- 4. approved -->
            <template v-else-if="authorization.status === 'approved'">
                <q-icon
                    name="sym_o_check_circle"
                    size="48px"
                    class="activate-state-icon activate-state-icon--success"
                />
                <h1 class="activate-title">CLI connected</h1>
                <p class="activate-text">
                    <b>{{ deviceName }}</b> is signed in as
                    {{ user?.email ?? user?.name }}. You can close this tab and
                    return to your terminal.
                </p>
                <div class="activate-command">
                    <code>klein project list</code>
                    <q-btn
                        flat
                        dense
                        no-caps
                        size="sm"
                        color="link-primary"
                        :label="copied ? 'Copied' : 'Copy'"
                        @click="copyFirstCommand"
                    />
                </div>
            </template>

            <!-- 5. denied -->
            <template v-else-if="authorization.status === 'denied'">
                <q-icon
                    name="sym_o_block"
                    size="48px"
                    class="activate-state-icon activate-state-icon--error"
                />
                <h1 class="activate-title">Login denied</h1>
                <p class="activate-text">
                    The CLI on <b>{{ deviceName }}</b> was not signed in. If
                    this was a mistake, run <code>klein login</code> again.
                </p>
            </template>

            <!-- 6. pending: ask for approval -->
            <template v-else>
                <h1 class="activate-title">Connect the Kleinkram CLI</h1>
                <p class="activate-subtitle">{{ instanceName }}</p>

                <p class="activate-text">
                    Check that this code matches the one in your terminal.
                </p>

                <div
                    class="activate-code"
                    :aria-label="`Code ${authorization.userCode}`"
                >
                    <span
                        v-for="(character, index) in authorization.userCode"
                        :key="index"
                        :class="{ 'activate-code__dash': character === '-' }"
                    >
                        {{ character === '-' ? '–' : character }}
                    </span>
                </div>

                <dl class="activate-details">
                    <div>
                        <dt>Signed in as</dt>
                        <dd>{{ user?.email ?? user?.name }}</dd>
                    </div>
                    <div>
                        <dt>Device</dt>
                        <dd>{{ deviceDescription }}</dd>
                    </div>
                    <div>
                        <dt>From</dt>
                        <dd>
                            {{ authorization.ipAddress }} · {{ startedAgo }}
                        </dd>
                    </div>
                </dl>

                <div class="activate-buttons">
                    <q-btn
                        flat
                        outline
                        no-caps
                        label="Deny"
                        class="activate-button button-border"
                        :loading="isDenying"
                        :disable="isApproving"
                        @click="deny"
                    />
                    <q-btn
                        flat
                        no-caps
                        label="Authorize CLI"
                        class="activate-button bg-button-primary"
                        :loading="isApproving"
                        :disable="isDenying"
                        @click="approve"
                    />
                </div>

                <p class="activate-note">
                    Only approve a code you started yourself. The CLI gets the
                    same access as your account until you run
                    <code>klein logout</code>.
                </p>
            </template>
        </div>
    </auth-frame>
</template>

<script setup lang="ts">
import type { DeviceAuthorizationInfoDto } from '@kleinkram/api-dto/types/cli/device-authorization.dto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import AuthFrame from 'components/common/auth-frame.vue';
import { Notify } from 'quasar';
import { useUser } from 'src/hooks/query-hooks';
import {
    approveDeviceAuthorization,
    denyDeviceAuthorization,
    getDeviceAuthorization,
} from 'src/services/queries/cli';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const $route = useRoute();
const $router = useRouter();
const queryClient = useQueryClient();
const { data: user } = useUser();

const instanceName = globalThis.location.host;

const userCode = computed(() => {
    const code = $route.query.code;
    return typeof code === 'string' && code.trim() !== ''
        ? code.trim().toUpperCase()
        : undefined;
});

// ----- code entry -----
const enteredCode = ref('');
const isCodeComplete = computed(
    () => enteredCode.value.replaceAll(/[^A-Z]/g, '').length === 8,
);

const formatEnteredCode = (value: string | number | null): void => {
    const letters = String(value ?? '')
        .toUpperCase()
        .replaceAll(/[^A-Z]/g, '')
        .slice(0, 8);
    enteredCode.value =
        letters.length > 4
            ? `${letters.slice(0, 4)}-${letters.slice(4)}`
            : letters;
};

const submitCode = async (): Promise<void> => {
    if (!isCodeComplete.value) return;
    await $router.replace({ query: { code: enteredCode.value } });
};

const clearCode = async (): Promise<void> => {
    enteredCode.value = '';
    await $router.replace({ query: {} });
};

// ----- pending login -----
const queryKey = computed(() => ['cli-device', userCode.value]);
const {
    data: authorization,
    isLoading,
    isError,
} = useQuery({
    queryKey,
    queryFn: () => getDeviceAuthorization(userCode.value ?? ''),
    enabled: computed(() => userCode.value !== undefined),
    retry: false,
});

const deviceName = computed(
    () => authorization.value?.hostname ?? 'this device',
);

const deviceDescription = computed(() => {
    const parts = [
        authorization.value?.hostname,
        authorization.value?.platform,
        authorization.value?.cliVersion
            ? `klein ${authorization.value.cliVersion}`
            : undefined,
    ].filter((part) => part !== undefined && part !== '');
    return parts.length > 0 ? parts.join(' · ') : 'Unknown device';
});

const startedAgo = computed(() => {
    if (!authorization.value) return '';
    const seconds = Math.max(
        0,
        Math.round(
            (Date.now() - new Date(authorization.value.createdAt).getTime()) /
                1000,
        ),
    );
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    return `${String(minutes)} min ago`;
});

const onDecided = (result: DeviceAuthorizationInfoDto): void => {
    queryClient.setQueryData(queryKey.value, result);
};

const onError = (error: unknown): void => {
    Notify.create({
        message:
            error instanceof Error
                ? `Could not update the login: ${error.message}`
                : 'Could not update the login',
        color: 'negative',
        position: 'bottom',
    });
    void queryClient.invalidateQueries({ queryKey: queryKey.value });
};

const { mutate: approve, isPending: isApproving } = useMutation({
    mutationFn: () => approveDeviceAuthorization(userCode.value ?? ''),
    onSuccess: onDecided,
    onError,
});

const { mutate: deny, isPending: isDenying } = useMutation({
    mutationFn: () => denyDeviceAuthorization(userCode.value ?? ''),
    onSuccess: onDecided,
    onError,
});

// ----- copy -----
const copied = ref(false);
const copyFirstCommand = async (): Promise<void> => {
    await navigator.clipboard.writeText('klein project list');
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
};
</script>

<style scoped>
/* Same card and type scale as the login page (see login-page.vue) */
.activate {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.activate-logo {
    align-self: center;
    height: 28px;
    margin-bottom: 48px;
    max-width: 100%;
}

.activate-title {
    font-size: 28px;
    font-weight: 400;
    line-height: 36px;
    margin: 0;
}

.activate-subtitle {
    color: #6f6f6f;
    font-size: 14px;
    line-height: 20px;
    margin: 4px 0 0;
}

.activate-text {
    color: #161616;
    font-size: 14px;
    letter-spacing: 0.16px;
    line-height: 20px;
    margin: 32px 0 24px;
}

.activate-text code,
.activate-note code {
    background: #f4f4f4;
    font-size: 12px;
    padding: 1px 4px;
}

.activate-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.activate-form :deep(.activate-code-input) {
    font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
    font-size: 22px;
    letter-spacing: 0.2em;
    text-align: center;
}

.activate-code {
    display: flex;
    flex-wrap: wrap;
    font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
    font-size: 24px;
    gap: 4px;
    justify-content: center;
}

.activate-code span {
    align-items: center;
    background: #f4f4f4;
    border-bottom: 1px solid #8d8d8d;
    display: flex;
    height: 52px;
    justify-content: center;
    width: 40px;
}

.activate-code span.activate-code__dash {
    background: none;
    border: 0;
    color: #8d8d8d;
    width: 16px;
}

.activate-details {
    font-size: 14px;
    margin: 32px 0 0;
    text-align: left;
}

.activate-details > div {
    border-top: 1px solid #e0e0e0;
    display: grid;
    gap: 16px;
    grid-template-columns: 112px minmax(0, 1fr);
    padding: 12px 0;
}

.activate-details > div:last-child {
    border-bottom: 1px solid #e0e0e0;
}

.activate-details dt {
    color: #6f6f6f;
}

.activate-details dd {
    margin: 0;
    overflow-wrap: anywhere;
}

.activate-buttons {
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr 1fr;
    margin-top: 32px;
}

.activate-button {
    min-height: 40px;
}

.activate-note {
    color: #6f6f6f;
    font-size: 12px;
    letter-spacing: 0.32px;
    line-height: 16px;
    margin: 24px 0 0;
    text-align: left;
}

.activate-loading {
    display: flex;
    justify-content: center;
    padding: 48px 0;
}

.activate-state-icon {
    align-self: center;
    margin-bottom: 24px;
}

.activate-state-icon--success {
    color: #24a148; /* $support-success */
}

.activate-state-icon--error {
    color: #da1e28; /* $support-error */
}

.activate-command {
    align-items: center;
    background: #f4f4f4;
    display: flex;
    gap: 8px;
    padding: 4px 4px 4px 12px;
    text-align: left;
}

.activate-command code {
    flex: 1 1 auto;
    font-size: 13px;
}

/* Comfortable touch targets on touch-sized viewports */
@media (max-width: 1023px) {
    .activate-button {
        min-height: 44px;
    }
}

@media (max-width: 599px) {
    .activate-logo {
        margin-bottom: 32px;
    }

    .activate-title {
        font-size: 24px;
        line-height: 32px;
    }

    .activate-code {
        font-size: 20px;
        gap: 2px;
    }

    .activate-code span {
        height: 44px;
        width: 32px;
    }

    .activate-details > div {
        gap: 4px;
        grid-template-columns: 1fr;
    }
}
</style>
