<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="flex column justify-between base-dialog__card"
            style="min-height: 400px; min-width: 600px"
        >
            <div :style="contentStyle">
                <div
                    class="q-pa-lg flex row justify-between base-dialog__header"
                >
                    <h3
                        class="text-h3 q-ma-none base-dialog__title"
                        style="max-width: 80%"
                    >
                        <slot name="title" />
                    </h3>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        class="button-border"
                        style="font-size: 14px; line-height: 14px; margin: 0"
                        icon="sym_o_close"
                        @click="onDialogCancel"
                    />
                </div>

                <div v-if="$slots.tabs" class="q-mx-lg base-dialog__tabs">
                    <div class="q-mt-md q-pa-none base-dialog__tabs-inner">
                        <slot name="tabs" />
                    </div>
                </div>

                <q-separator />
                <div class="base-dialog__content">
                    <slot name="content" />
                </div>
            </div>

            <div>
                <q-separator />
                <div class="q-pa-lg flex row justify-end base-dialog__actions">
                    <slot name="actions" />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { computed, ComputedRef, CSSProperties, PropType } from 'vue';

export default {
    name: 'BaseDialog',
    props: {
        contentHeight: {
            type: String as PropType<string | undefined>,
            default: undefined,
        },
    },
    emits: [...useDialogPluginComponent.emits],
    setup(properties): ReturnType<useDialogPluginComponent> & {
        contentStyle: ComputedRef<CSSProperties>;
    } {
        const contentStyle = computed<CSSProperties>(() => ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            height: properties.contentHeight ?? 'auto',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            overflowY: properties.contentHeight ? 'hidden' : 'visible',
        }));
        const dialogPlugin = useDialogPluginComponent();
        return { ...dialogPlugin, contentStyle };
    },
};
</script>

<style scoped>
/* The tabs must not widen the dialog: they scroll inside their row */
.base-dialog__tabs {
    display: flex;
    justify-content: flex-start;
    min-width: 0;
    max-width: 100%;
}

.base-dialog__tabs-inner {
    min-width: 0;
    max-width: 100%;
}

.base-dialog__card,
.base-dialog__card > div {
    min-width: 0;
    max-width: 100%;
}

.base-dialog__content {
    margin: 40px 24px;
    max-height: calc(min(650px, 100vh - 350px));
    overflow-y: auto;
}

@media (max-width: 599px) {
    .base-dialog__card {
        min-height: 0 !important;
    }

    .base-dialog__content {
        margin: 16px;
        max-height: calc(100vh - 200px);
    }

    .base-dialog__header,
    .base-dialog__actions {
        padding: 16px;
    }

    .base-dialog__tabs {
        margin: 0 16px;
    }

    .base-dialog__tabs-inner {
        width: 100%;
    }

    .base-dialog__title {
        font-size: 1.5rem;
        line-height: 2rem;
    }

    .base-dialog__actions {
        gap: 8px;
    }
}
</style>
