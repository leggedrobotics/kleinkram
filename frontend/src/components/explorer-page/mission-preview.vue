<template>
    <div
        ref="root"
        class="mission-preview"
        :class="{ 'bg-white': isFullscreen }"
    >
        <aside v-show="!isSidebarCollapsed" class="mission-preview__sidebar">
            <q-input
                v-model="orgSlugInput"
                dense
                outlined
                label="Foxglove organization"
                hint="Slug of the org you sign in to inside the viewer"
                debounce="600"
            />

            <q-btn-toggle
                v-if="availableFormats.length > 1"
                :model-value="format"
                class="q-mt-md"
                spread
                unelevated
                no-caps
                toggle-color="primary"
                color="grey-3"
                text-color="grey-9"
                :options="
                    availableFormats.map((f) => ({
                        label: `${f} (${filesByFormat[f]?.length ?? 0})`,
                        value: f,
                    }))
                "
                @update:model-value="onFormatChange"
            >
                <q-tooltip>
                    Foxglove merges files of one format only
                </q-tooltip>
            </q-btn-toggle>

            <q-btn-toggle
                v-model="transfer"
                class="q-mt-md"
                spread
                unelevated
                no-caps
                toggle-color="primary"
                color="grey-3"
                text-color="grey-9"
                :options="[
                    { label: 'Stream', value: 'stream' },
                    { label: 'Download first', value: 'download' },
                ]"
            >
                <q-tooltip max-width="280px">
                    Stream: Foxglove fetches signed links itself and reads only
                    the ranges it needs. Download first: Kleinkram downloads the
                    files in this tab and hands them over, so Foxglove needs no
                    access to the storage.
                </q-tooltip>
            </q-btn-toggle>

            <q-toggle
                v-if="transfer === 'download'"
                v-model="compare"
                dense
                class="q-mt-sm"
                label="Compare instead of merge"
            />

            <div class="row items-center justify-between q-mt-md">
                <span class="text-caption text-grey-8">
                    {{ selected.length }} of {{ candidates.length }} files ·
                    {{ formatSize(selectedSize) }}
                </span>
                <q-btn
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="primary"
                    :label="allSelected ? 'None' : 'All'"
                    @click="toggleAll"
                />
            </div>

            <q-list dense class="mission-preview__files">
                <q-item
                    v-for="file in candidates"
                    :key="file.uuid"
                    v-ripple
                    clickable
                    dense
                    @click="() => toggle(file.uuid)"
                >
                    <q-item-section side>
                        <q-checkbox
                            dense
                            :model-value="selected.includes(file.uuid)"
                            @update:model-value="() => toggle(file.uuid)"
                            @click.stop
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="ellipsis">
                            {{ file.filename }}
                            <q-tooltip>{{ file.filename }}</q-tooltip>
                        </q-item-label>
                        <q-item-label caption>
                            {{ formatSize(file.size) }}
                        </q-item-label>
                    </q-item-section>
                </q-item>
                <div
                    v-if="!isLoadingFiles && candidates.length === 0"
                    class="text-grey-7 q-pa-md text-center"
                >
                    This mission has no .mcap or .bag files.
                </div>
            </q-list>

            <q-btn
                class="q-mt-md full-width"
                unelevated
                no-caps
                color="primary"
                icon="sym_o_play_arrow"
                :label="isDirty ? 'Load selection' : 'Reload'"
                :loading="isLoadingLinks"
                :disable="selected.length === 0"
                @click="load"
            />
        </aside>

        <section class="mission-preview__viewer">
            <div class="mission-preview__toolbar">
                <q-btn
                    flat
                    dense
                    :icon="
                        isSidebarCollapsed
                            ? 'sym_o_left_panel_open'
                            : 'sym_o_left_panel_close'
                    "
                    @click="toggleSidebar"
                >
                    <q-tooltip>Toggle file list</q-tooltip>
                </q-btn>
                <span class="text-caption text-grey-8 ellipsis">
                    {{ statusText }}
                </span>
                <q-space />
                <q-btn-toggle
                    v-model="layoutScope"
                    dense
                    unelevated
                    no-caps
                    size="sm"
                    toggle-color="primary"
                    color="grey-3"
                    text-color="grey-9"
                    :options="[
                        { label: 'Project layout', value: 'project' },
                        { label: 'Mission layout', value: 'mission' },
                    ]"
                >
                    <q-tooltip>
                        Panel arrangement is remembered in this browser, per
                        project or per mission
                    </q-tooltip>
                </q-btn-toggle>
                <q-btn flat dense icon="sym_o_download" @click="exportLayout">
                    <q-tooltip>Export layout as JSON</q-tooltip>
                </q-btn>
                <q-btn
                    flat
                    dense
                    :icon="
                        isFullscreen
                            ? 'sym_o_fullscreen_exit'
                            : 'sym_o_fullscreen'
                    "
                    @click="toggleFullscreen"
                >
                    <q-tooltip>Fullscreen</q-tooltip>
                </q-btn>
            </div>

            <foxglove-embed
                ref="embed"
                class="mission-preview__embed"
                :urls="urls"
                :files="localFiles"
                :compare="compare"
                :org-slug="orgSlug"
                :layout-key="layoutKey"
                @error="onViewerError"
            />
        </section>
    </div>
</template>

<script setup lang="ts">
import type { FileDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FileState, FileType } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import FoxgloveEmbed from 'components/foxglove/foxglove-embed.vue';
import { exportFile, Notify } from 'quasar';
import ENV from 'src/environment';
import { useMissionUUID, useProjectUUID } from 'src/hooks/router-hooks';
import { formatSize } from 'src/services/general-formatting';
import {
    downloadFile,
    filesOfMission,
    getFoxgloveLink,
} from 'src/services/queries/file';
import {
    computed,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    watch,
} from 'vue';
import { useRoute } from 'vue-router';

type PreviewFormat = FileType.MCAP | FileType.BAG;

const ORG_SLUG_STORAGE_KEY = 'kleinkram.foxglove.orgSlug';
const PAGE_SIZE = 500;

const $route = useRoute();
const missionUuid = useMissionUUID();
const projectUuid = useProjectUUID();

const root = ref<HTMLElement | null>(null);
const embed = ref<{ getLayout: () => Promise<unknown> } | null>(null);

const orgSlugInput = ref(localStorage.getItem(ORG_SLUG_STORAGE_KEY) ?? '');
const orgSlug = computed(() => orgSlugInput.value.trim() || undefined);
watch(orgSlugInput, (value) => {
    localStorage.setItem(ORG_SLUG_STORAGE_KEY, value.trim());
});

const layoutScope = ref<'project' | 'mission'>('project');
const layoutKey = computed(() =>
    layoutScope.value === 'project'
        ? `kleinkram-project-${projectUuid.value ?? ''}`
        : `kleinkram-mission-${missionUuid.value ?? ''}`,
);

const { data: files, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['mission-preview-files', missionUuid],
    queryFn: async (): Promise<FileDto[]> => {
        // All pages, so files picked anywhere on the files tab can be resolved.
        const result: FileDto[] = [];
        for (;;) {
            const response = await filesOfMission(
                missionUuid.value ?? '',
                PAGE_SIZE,
                result.length,
                [FileType.MCAP, FileType.BAG],
            );
            result.push(...response.data);
            if (response.data.length === 0 || result.length >= response.count) {
                return result;
            }
        }
    },
    enabled: computed(() => !!missionUuid.value),
});

const filesByFormat = computed(() => {
    const groups: Partial<Record<PreviewFormat, FileDto[]>> = {};
    for (const file of files.value ?? []) {
        if (file.state !== FileState.OK && file.state !== FileState.FOUND) {
            continue;
        }
        if (file.type !== FileType.MCAP && file.type !== FileType.BAG) continue;
        (groups[file.type] ??= []).push(file);
    }
    return groups;
});

const availableFormats = computed(
    () => Object.keys(filesByFormat.value) as PreviewFormat[],
);
const format = ref<PreviewFormat>(FileType.MCAP);
const candidates = computed(() => filesByFormat.value[format.value] ?? []);

const selected = ref<string[]>([]);
const loaded = ref<string[]>([]);
const urls = ref<string[]>([]);
const localFiles = shallowRef<File[]>([]);
const compare = ref(false);

// Browsers do not let embed.foxglove.dev fetch from a loopback address, so a
// local instance hands the files over instead of streaming them.
const transfer = ref<'stream' | 'download'>(
    ENV.BACKEND_URL.includes('localhost') ? 'download' : 'stream',
);
const loadedTransfer = ref(transfer.value);
const isLoadingLinks = ref(false);
const viewerError = ref<string | undefined>();

const selectedSize = computed(() =>
    candidates.value
        .filter((file) => selected.value.includes(file.uuid))
        .reduce((sum, file) => sum + file.size, 0),
);
const allSelected = computed(
    () =>
        candidates.value.length > 0 &&
        selected.value.length === candidates.value.length,
);
const isDirty = computed(
    () =>
        selected.value.toSorted().join(',') !== loaded.value.join(',') ||
        transfer.value !== loadedTransfer.value,
);

const statusText = computed(() => {
    if (viewerError.value) return `Foxglove: ${viewerError.value}`;
    if (isLoadingLinks.value) {
        return transfer.value === 'download'
            ? 'Downloading files…'
            : 'Signing file links…';
    }
    if (loaded.value.length === 0) return 'Nothing loaded yet';
    const noun = loaded.value.length === 1 ? 'file' : 'files';
    return `${String(loaded.value.length)} ${noun} handed to Foxglove`;
});

function toggle(uuid: string): void {
    selected.value = selected.value.includes(uuid)
        ? selected.value.filter((u) => u !== uuid)
        : [...selected.value, uuid];
}

function toggleAll(): void {
    selected.value = allSelected.value
        ? []
        : candidates.value.map((file) => file.uuid);
}

// Bumped by every load and on unmount, so results of an outdated load are
// dropped and its downloads cancelled.
let loadGeneration = 0;
let loadAbort: AbortController | undefined;

async function fetchAsFile(uuid: string, signal: AbortSignal): Promise<File> {
    const url = await downloadFile(uuid, true);
    const response = await fetch(url, { signal });
    if (!response.ok)
        throw new Error(`Download failed: ${String(response.status)}`);
    const filename =
        candidates.value.find((file) => file.uuid === uuid)?.filename ?? uuid;
    return new File([await response.blob()], filename);
}

async function load(): Promise<void> {
    const uuids = selected.value.toSorted();
    const mode = transfer.value;
    const generation = ++loadGeneration;
    loadAbort?.abort();
    const abort = new AbortController();
    loadAbort = abort;

    isLoadingLinks.value = true;
    viewerError.value = undefined;
    try {
        let nextFiles: File[] = [];
        let nextUrls: string[] = [];
        if (mode === 'download') {
            nextFiles = await Promise.all(
                uuids.map(async (uuid) => fetchAsFile(uuid, abort.signal)),
            );
        } else {
            nextUrls = await Promise.all(
                uuids.map((uuid) => getFoxgloveLink(uuid)),
            );
        }
        if (generation !== loadGeneration) return;
        localFiles.value = nextFiles;
        urls.value = nextUrls;
        loadedTransfer.value = mode;
        loaded.value = uuids;
    } catch (error: unknown) {
        if (generation !== loadGeneration) return;
        console.error(error);
        Notify.create({
            message: 'Failed to prepare the files for Foxglove',
            color: 'negative',
            position: 'bottom',
        });
    } finally {
        if (generation === loadGeneration) isLoadingLinks.value = false;
    }
}

function onViewerError(message: string): void {
    viewerError.value = message;
}

async function exportLayout(): Promise<void> {
    const layout = await embed.value?.getLayout();
    if (layout === undefined) return;
    exportFile(
        `${layoutKey.value}.json`,
        JSON.stringify(layout, undefined, 2),
        'application/json',
    );
}

// Preselect the files handed over via `?files=a,b` (selection bar of the
// files tab), otherwise every file of the most common format.
let isInitialized = false;
watch(
    filesByFormat,
    (groups) => {
        if (isInitialized || files.value === undefined) return;
        isInitialized = true;

        const requested = new Set(
            typeof $route.query.files === 'string'
                ? $route.query.files.split(',')
                : [],
        );
        const all = [...(groups.MCAP ?? []), ...(groups.BAG ?? [])];
        const requestedFiles = all.filter((file) => requested.has(file.uuid));

        const first = requestedFiles[0];
        if (requested.size > 0) {
            // Files were picked explicitly: never fall back to other files.
            if (first) {
                format.value = first.type as PreviewFormat;
                selected.value = requestedFiles
                    .filter((file) => file.type === first.type)
                    .map((file) => file.uuid);
            }
            const skipped = requested.size - selected.value.length;
            if (skipped > 0) {
                Notify.create({
                    message: `${String(skipped)} of the selected files cannot be previewed together (other format, or not in state OK)`,
                    color: 'warning',
                    position: 'bottom',
                });
            }
        } else {
            format.value =
                (groups.BAG?.length ?? 0) > (groups.MCAP?.length ?? 0)
                    ? FileType.BAG
                    : FileType.MCAP;
            selected.value = candidates.value.map((file) => file.uuid);
        }
        if (selected.value.length > 0) void load();
    },
    { immediate: true },
);

function onFormatChange(value: PreviewFormat): void {
    format.value = value;
    selected.value = candidates.value.map((file) => file.uuid);
}

const isSidebarCollapsed = ref(false);

function toggleSidebar(): void {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
}
const isFullscreen = ref(false);

function toggleFullscreen(): void {
    if (document.fullscreenElement) {
        void document.exitFullscreen();
    } else {
        void root.value?.requestFullscreen();
    }
}

function onFullscreenChange(): void {
    isFullscreen.value = document.fullscreenElement === root.value;
}

onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange);
});
onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    loadGeneration++;
    loadAbort?.abort();
});
</script>

<style scoped>
.mission-preview {
    display: flex;
    gap: 16px;
    height: calc(100vh - 260px);
    min-height: 480px;
}

.mission-preview:fullscreen {
    height: 100vh;
    padding: 12px;
}

.mission-preview__sidebar {
    display: flex;
    flex-direction: column;
    width: 300px;
    flex-shrink: 0;
    min-height: 0;
}

.mission-preview__files {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    margin-top: 4px;
}

.mission-preview__viewer {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
}

.mission-preview__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-bottom: 1px solid #e0e0e0;
}

.mission-preview__embed {
    flex: 1;
    min-height: 0;
}
</style>
