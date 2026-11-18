<template>
    <div style="margin: auto 0">
        <q-btn
            round
            flat
            color="grey-8"
            icon="sym_o_terminal"
            aria-label="Use Kleinkram from the terminal"
        >
            <q-tooltip>Use from terminal</q-tooltip>
            <q-menu
                :offset="[0, 12]"
                anchor="bottom right"
                self="top right"
                :style="{
                    width: $q.screen.gt.xs ? '440px' : '100vw',
                    maxWidth: '100vw',
                }"
            >
                <div class="cli-menu">
                    <div class="cli-menu__title">
                        <q-icon name="sym_o_terminal" size="22px" />
                        Use Kleinkram from the terminal
                    </div>

                    <div
                        v-for="(step, index) in steps"
                        :key="step.title"
                        class="cli-menu__step"
                    >
                        <span class="cli-menu__number">{{ index + 1 }}</span>
                        <div class="cli-menu__step-body">
                            <b>{{ step.title }}</b>
                            <div class="cli-menu__command">
                                <code>{{ step.command }}</code>
                                <q-btn
                                    flat
                                    dense
                                    no-caps
                                    size="sm"
                                    color="link-primary"
                                    :label="
                                        copied === index ? 'Copied' : 'Copy'
                                    "
                                    :aria-label="`Copy ${step.command}`"
                                    @click="() => copy(step.command, index)"
                                />
                            </div>
                            <span v-if="step.hint" class="cli-menu__hint">
                                {{ step.hint }}
                            </span>
                        </div>
                    </div>

                    <div class="cli-menu__meta">
                        <span v-if="cliConfig">
                            Server {{ cliConfig.serverVersion }} · needs CLI ≥
                            {{ cliConfig.minCliVersion }}
                        </span>
                        <span v-else />
                        <span>
                            <router-link
                                v-close-popup
                                :to="ROUTES.USER_PROFILE.path"
                            >
                                API keys for scripts
                            </router-link>
                            ·
                            <a :href="cliDocumentationUrl" target="_blank"
                                >CLI docs</a
                            >
                        </span>
                    </div>
                </div>
            </q-menu>
        </q-btn>
    </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useQuasar } from 'quasar';
import ROUTES from 'src/router/routes';
import { getCliConfig } from 'src/services/queries/cli';
import { computed, ref } from 'vue';
import ENV from '../../../environment';

const $q = useQuasar();

const { data: cliConfig } = useQuery({
    queryKey: ['cli-config'],
    queryFn: getCliConfig,
    staleTime: Infinity,
    retry: false,
});

// the address people have in their browser is the one `klein login` expects
const loginUrl = computed(
    () => cliConfig.value?.frontendUrl ?? globalThis.location.origin,
);

const cliDocumentationUrl = computed(
    () => `${cliConfig.value?.docsUrl ?? ENV.DOCS_URL}/usage/python/setup`,
);

const steps = computed(() => [
    { title: 'Install the CLI', command: 'pip install kleinkram' },
    {
        title: 'Sign in to this server',
        command: `klein login ${loginUrl.value}`,
        hint: 'Works over SSH too: you get a code to enter at /cli/activate.',
    },
    { title: 'Try it', command: 'klein project list' },
]);

const copied = ref<number | undefined>(undefined);

const copy = async (text: string, index: number): Promise<void> => {
    await navigator.clipboard.writeText(text);
    copied.value = index;
    setTimeout(() => {
        if (copied.value === index) copied.value = undefined;
    }, 1500);
};
</script>

<style scoped>
.cli-menu {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
}

.cli-menu__title {
    align-items: center;
    display: flex;
    font-size: 16px;
    font-weight: 600;
    gap: 8px;
}

.cli-menu__step {
    display: grid;
    gap: 10px;
    grid-template-columns: 22px minmax(0, 1fr);
}

.cli-menu__number {
    align-items: center;
    background: #e6efff;
    border-radius: 50%;
    color: #0f62fe; /* $link-primary */
    display: flex;
    font-size: 12px;
    font-weight: 600;
    height: 22px;
    justify-content: center;
}

.cli-menu__step-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.cli-menu__command {
    align-items: center;
    background: #f6f7f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    display: flex;
    gap: 8px;
    padding: 4px 4px 4px 10px;
}

.cli-menu__command code {
    flex: 1 1 auto;
    font-size: 12px;
    min-width: 0;
    overflow-x: auto;
    white-space: nowrap;
}

.cli-menu__hint {
    color: #6b7280;
    font-size: 12px;
}

.cli-menu__meta {
    border-top: 1px solid #e0e0e0;
    color: #6b7280;
    display: flex;
    flex-wrap: wrap;
    font-size: 12px;
    gap: 8px;
    justify-content: space-between;
    padding-top: 10px;
}

.cli-menu__meta a {
    color: #0f62fe; /* $link-primary */
    font-weight: 500;
    text-decoration: none;
}
</style>
