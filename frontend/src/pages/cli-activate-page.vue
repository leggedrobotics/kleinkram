<template>
    <div class="activate-page flex flex-center bg-grey-2">
        <div class="activate-card">
            <!-- 1. no code yet: ask for the one from the terminal -->
            <template v-if="!userCode">
                <div class="activate-head">
                    <div class="activate-glyph">
                        <q-icon name="sym_o_terminal" size="22px" />
                    </div>
                    <div>
                        <h1 class="activate-title">
                            Enter the code from your terminal
                        </h1>
                        <span class="activate-caption">
                            {{ instanceName }}
                        </span>
                    </div>
                </div>
                <p class="activate-text">
                    <code>klein login</code> shows a code like
                    <code>KQMX-TRBC</code>. Type it here to connect the CLI to
                    your account.
                </p>
                <form class="activate-form" @submit.prevent="submitCode">
                    <q-input
                        v-model="enteredCode"
                        outlined
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
                        unelevated
                        color="button-primary"
                        label="Continue"
                        type="submit"
                        class="full-width activate-button"
                        :disable="!isCodeComplete"
                    />
                </form>
            </template>

            <!-- 2. loading the login -->
            <div v-else-if="isLoading" class="activate-center">
                <q-spinner color="link-primary" size="40px" />
            </div>

            <!-- 3. unknown or expired code -->
            <template v-else-if="isError || !authorization">
                <div class="activate-state">
                    <div class="activate-ring activate-ring--bad">
                        <q-icon name="sym_o_timer_off" size="26px" />
                    </div>
                    <h1 class="activate-title">Code not found</h1>
                    <p class="activate-text">
                        <b>{{ userCode }}</b> is unknown or has expired (codes
                        are valid for 10 minutes). Run
                        <code>klein login</code> again to get a new one.
                    </p>
                    <q-btn
                        flat
                        no-caps
                        color="link-primary"
                        label="Enter another code"
                        @click="clearCode"
                    />
                </div>
            </template>

            <!-- 4. approved -->
            <template v-else-if="authorization.status === 'approved'">
                <div class="activate-state">
                    <div class="activate-ring activate-ring--ok">
                        <q-icon name="sym_o_check" size="28px" />
                    </div>
                    <h1 class="activate-title">CLI connected</h1>
                    <p class="activate-text">
                        <b>{{ deviceName }}</b> is signed in as
                        {{ user?.email ?? user?.name }}.<br />
                        You can close this tab and return to your terminal.
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
                </div>
            </template>

            <!-- 5. denied -->
            <template v-else-if="authorization.status === 'denied'">
                <div class="activate-state">
                    <div class="activate-ring activate-ring--bad">
                        <q-icon name="sym_o_block" size="26px" />
                    </div>
                    <h1 class="activate-title">Login denied</h1>
                    <p class="activate-text">
                        The CLI on <b>{{ deviceName }}</b> was not signed in. If
                        this was a mistake, run <code>klein login</code>
                        again.
                    </p>
                </div>
            </template>

            <!-- 6. pending: ask for approval -->
            <template v-else>
                <div class="activate-head">
                    <div class="activate-glyph">
                        <q-icon name="sym_o_terminal" size="22px" />
                    </div>
                    <div>
                        <h1 class="activate-title">
                            Connect the Kleinkram CLI
                        </h1>
                        <span class="activate-caption">
                            {{ instanceName }}
                        </span>
                    </div>
                </div>

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
                    <dt>Signed in as</dt>
                    <dd>{{ user?.email ?? user?.name }}</dd>
                    <dt>Device</dt>
                    <dd>{{ deviceDescription }}</dd>
                    <dt>From</dt>
                    <dd>
                        {{ authorization.ipAddress }} ·
                        {{ startedAgo }}
                    </dd>
                </dl>

                <div class="activate-buttons">
                    <q-btn
                        outline
                        no-caps
                        color="grey-8"
                        label="Deny"
                        class="activate-button"
                        :loading="isDenying"
                        :disable="isApproving"
                        @click="deny"
                    />
                    <q-btn
                        unelevated
                        no-caps
                        color="button-primary"
                        label="Authorize CLI"
                        class="activate-button"
                        :loading="isApproving"
                        :disable="isDenying"
                        @click="approve"
                    />
                </div>

                <p class="activate-note">
                    <q-icon name="sym_o_info" size="16px" />
                    <span>
                        Only approve a code you started yourself. The CLI gets
                        the same access as your account until you run
                        <code>klein logout</code>.
                    </span>
                </p>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { DeviceAuthorizationInfoDto } from '@kleinkram/api-dto/types/cli/device-authorization.dto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
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
.activate-page {
    flex: 1 1 auto;
    min-height: 0;
    padding: 48px 16px;
}

.activate-card {
    background: white;
    border: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 100%;
    padding: 32px;
    width: 480px;
}

.activate-head {
    align-items: center;
    display: flex;
    gap: 14px;
}

.activate-glyph {
    align-items: center;
    background: #e6efff;
    border-radius: 10px;
    color: #0f62fe; /* $link-primary */
    display: flex;
    flex: none;
    height: 42px;
    justify-content: center;
    width: 42px;
}

.activate-title {
    font-size: 20px;
    font-weight: 500;
    line-height: 28px;
    margin: 0;
}

.activate-caption {
    color: #6b7280;
    font-size: 13px;
}

.activate-text {
    color: #424242;
    font-size: 14px;
    line-height: 1.6;
    margin: 0;
}

.activate-text code,
.activate-note code {
    background: #f1f3f6;
    border-radius: 4px;
    font-size: 12px;
    padding: 1px 5px;
}

.activate-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.activate-form :deep(.activate-code-input) {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-align: center;
}

.activate-code {
    display: flex;
    flex-wrap: wrap;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 22px;
    font-weight: 600;
    gap: 6px;
    justify-content: center;
}

.activate-code span {
    align-items: center;
    background: #f6f7f9;
    border: 1.5px solid #e0e0e0;
    border-radius: 8px;
    display: flex;
    height: 48px;
    justify-content: center;
    width: 38px;
}

.activate-code span.activate-code__dash {
    background: none;
    border: 0;
    color: #9ca3af;
    width: 12px;
}

.activate-details {
    background: #f6f7f9;
    border-radius: 8px;
    display: grid;
    font-size: 13px;
    gap: 6px 14px;
    grid-template-columns: auto minmax(0, 1fr);
    margin: 0;
    padding: 12px 14px;
}

.activate-details dt {
    color: #6b7280;
}

.activate-details dd {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 12px;
    margin: 0;
    overflow-wrap: anywhere;
}

.activate-buttons {
    display: flex;
    gap: 10px;
}

.activate-buttons .activate-button {
    flex: 1 1 0;
}

.activate-button {
    min-height: 40px;
}

.activate-note {
    align-items: flex-start;
    color: #6b7280;
    display: flex;
    font-size: 12px;
    gap: 8px;
    line-height: 1.5;
    margin: 0;
}

.activate-center {
    display: flex;
    justify-content: center;
    padding: 40px 0;
}

.activate-state {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
}

.activate-ring {
    align-items: center;
    border-radius: 50%;
    display: flex;
    height: 54px;
    justify-content: center;
    width: 54px;
}

.activate-ring--ok {
    background: #e5f5ec;
    color: #1d8a4a;
}

.activate-ring--bad {
    background: #fdecec;
    color: #c62828;
}

.activate-command {
    align-items: center;
    background: #f6f7f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    display: flex;
    gap: 8px;
    padding: 4px 4px 4px 10px;
    width: 100%;
}

.activate-command code {
    flex: 1 1 auto;
    font-size: 13px;
    text-align: left;
}

@media (max-width: 599px) {
    .activate-page {
        padding: 24px 12px;
    }

    .activate-card {
        padding: 24px 18px;
    }

    .activate-code {
        font-size: 18px;
        gap: 4px;
    }

    .activate-code span {
        height: 42px;
        width: 30px;
    }
}
</style>
