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
                    borderRadius: '8px',
                }"
            >
                <div class="cli-menu">
                    <div class="cli-menu__header">
                        <div class="cli-menu__title">
                            Use Kleinkram from the terminal
                        </div>
                        <div v-if="cliConfig" class="cli-menu__subtitle">
                            Server {{ cliConfig.serverVersion }} · needs CLI ≥
                            {{ cliConfig.minCliVersion }}
                        </div>
                    </div>

                    <ol class="cli-menu__steps">
                        <li
                            v-for="(step, index) in steps"
                            :key="step.title"
                            class="cli-menu__step"
                        >
                            <span class="cli-menu__number" aria-hidden="true">
                                {{ index + 1 }}
                            </span>
                            <div class="cli-menu__step-body">
                                <span class="cli-menu__step-title">
                                    {{ step.title }}
                                </span>
                                <div class="cli-menu__command">
                                    <code>{{ step.command }}</code>
                                    <q-btn
                                        flat
                                        dense
                                        round
                                        size="sm"
                                        color="grey-8"
                                        :icon="
                                            copied === index
                                                ? 'sym_o_check'
                                                : 'sym_o_content_copy'
                                        "
                                        :aria-label="`Copy ${step.command}`"
                                        @click="() => copy(step.command, index)"
                                    >
                                        <q-tooltip>
                                            {{
                                                copied === index
                                                    ? 'Copied'
                                                    : 'Copy'
                                            }}
                                        </q-tooltip>
                                    </q-btn>
                                </div>
                                <span v-if="step.hint" class="cli-menu__hint">
                                    {{ step.hint }}
                                </span>
                            </div>
                        </li>
                    </ol>

                    <div class="cli-menu__footer">
                        <a :href="cliDocumentationUrl" target="_blank">
                            CLI docs
                        </a>
                    </div>
                </div>
            </q-menu>
        </q-btn>
    </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useQuasar } from 'quasar';
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
        hint: 'Over SSH you get a code to enter at /cli/activate.',
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
/* Same tokens as BaseDialog: $text-primary #161616, $text-secondary #525252,
   $layer #f4f4f4, $border-subtle #e0e0e0, $link-primary #0f62fe */
.cli-menu {
    color: #161616;
}

.cli-menu__header {
    padding: 20px 24px 0;
}

.cli-menu__title {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.75rem;
}

.cli-menu__subtitle {
    margin-top: 2px;
    color: #525252;
    font-size: 12px;
}

.cli-menu__steps {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0;
    padding: 16px 24px 24px;
    list-style: none;
}

.cli-menu__step {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 8px;
}

.cli-menu__number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border-radius: 50%;
    background: #e0e0e0;
    font-size: 11px;
    font-weight: 600;
}

.cli-menu__step-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.cli-menu__step-title {
    font-weight: 500;
}

.cli-menu__command {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 4px 0 12px;
    border-radius: 4px;
    background: #f4f4f4;
}

.cli-menu__command code {
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    font-size: 13px;
    white-space: nowrap;
}

.cli-menu__hint {
    color: #525252;
    font-size: 12px;
}

.cli-menu__footer {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 12px 24px;
    border-top: 1px solid #e0e0e0;
    background: #f4f4f4;
    font-size: 13px;
}

.cli-menu__footer a {
    color: #0f62fe;
    font-weight: 500;
    text-decoration: none;
}

.cli-menu__footer a:hover {
    text-decoration: underline;
}
</style>
