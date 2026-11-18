<template>
    <div ref="container" class="foxglove-embed" />
</template>

<script setup lang="ts">
import { FoxgloveViewer, type DataSource } from '@foxglove/embed';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
    /** signed, CORS-enabled URLs; all files must share one format */
    urls: string[];
    /**
     * Files already downloaded by Kleinkram. Takes precedence over `urls`;
     * the viewer then needs no network access to the storage at all.
     */
    files?: File[];
    /** show the files side by side instead of merged (needs `files`) */
    compare?: boolean;
    /** Foxglove organization the user is asked to sign in to */
    orgSlug: string | undefined;
    /** layouts are persisted by Foxglove in the browser under this key */
    layoutKey: string;
}>();

const emit = defineEmits<{
    ready: [];
    error: [message: string];
}>();

const container = ref<HTMLElement | null>(null);
let viewer: FoxgloveViewer | undefined;

// The SDK hands its arguments to `postMessage`, which cannot clone Vue's
// reactive proxies, so the lists are copied into plain arrays first.
function dataSource(): DataSource | undefined {
    const files = props.files ?? [];
    if (files.length > 0) {
        return {
            type: 'file',
            file: [...files],
            compare: props.compare === true && files.length > 1,
        };
    }
    if (props.urls.length > 0) {
        return { type: 'remote-file', urls: [...props.urls] };
    }
    return undefined;
}

function applyDataSource(): void {
    const source = dataSource();
    if (viewer && source) viewer.setDataSource(source);
}

function createViewer(): void {
    if (!container.value) return;
    viewer?.destroy();

    const initialDataSource = dataSource();
    viewer = new FoxgloveViewer({
        parent: container.value,
        orgSlug: props.orgSlug,
        colorScheme: 'light',
        initialLayoutParams: { storageKey: props.layoutKey },
        ...(initialDataSource ? { initialDataSource } : {}),
    });

    // The SDK does not delegate local network access to its iframe. Without
    // it, Chrome blocks embed.foxglove.dev from fetching files of a Kleinkram
    // instance running on localhost. Not needed for a public deployment.
    // Chrome renamed the permission, so both generations are listed, and the
    // frame is navigated again so the policy applies to the loaded document.
    const iframe = container.value.querySelector('iframe');
    if (iframe) {
        iframe.allow = `${iframe.allow}; loopback-network *; local-network *; local-network-access *`;
        iframe.src = String(iframe.src);
    }

    viewer.addEventListener('ready', () => {
        emit('ready');
    });
    viewer.addEventListener('error', (event) => {
        emit('error', event.detail);
    });
}

onMounted(createViewer);
onBeforeUnmount(() => {
    viewer?.destroy();
    viewer = undefined;
});

watch(() => [props.urls, props.files, props.compare], applyDataSource);
watch(
    () => props.layoutKey,
    (storageKey) => {
        viewer?.selectLayout({ storageKey });
    },
);
// the organization is fixed when the iframe is created
watch(() => props.orgSlug, createViewer);

defineExpose({
    getLayout: async (): Promise<unknown> => viewer?.getLayout(),
    setLayout: (opaqueLayout: unknown): void => {
        viewer?.selectLayout({
            storageKey: props.layoutKey,
            opaqueLayout: opaqueLayout as never,
            force: true,
        });
    },
});
</script>

<style scoped>
.foxglove-embed {
    width: 100%;
    height: 100%;
}

.foxglove-embed :deep(iframe) {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
}
</style>
