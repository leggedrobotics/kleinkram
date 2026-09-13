<template>
    <div class="q-mt-lg">
        <h2 class="text-h5 q-mb-sm text-grey-9">
            File Versions
            <span class="text-body2 text-grey-6 q-ml-xs">
                {{ versions.length }}
            </span>
        </h2>
        <p class="text-body2 text-grey-7 q-mb-sm">
            Every upload under the same name is kept as its own version. The
            latest one is what the file resolves to everywhere else; older ones
            stay available for download.
        </p>

        <q-list bordered separator dense class="rounded-borders">
            <q-item
                v-for="version in versions"
                :key="version.uuid"
                class="q-py-sm"
            >
                <q-item-section
                    avatar
                    class="q-pr-none"
                    style="min-width: 56px"
                >
                    <q-chip
                        dense
                        square
                        :color="
                            version.uuid === activeVersionUuid
                                ? 'primary'
                                : 'grey-3'
                        "
                        :text-color="
                            version.uuid === activeVersionUuid
                                ? 'white'
                                : 'grey-8'
                        "
                        :label="`v${version.versionNumber}`"
                        class="q-ma-none text-weight-medium"
                    />
                </q-item-section>

                <q-item-section>
                    <q-item-label>
                        {{ formatDate(version.createdAt, true) }}
                        <q-badge
                            v-if="version.uuid === activeVersionUuid"
                            outline
                            color="primary"
                            label="Current"
                            class="q-ml-xs"
                        />
                    </q-item-label>
                    <q-item-label caption class="text-grey-6">
                        {{ formatSize(version.size) }}
                        <span v-if="version.hash">
                            &middot; MD5 {{ version.hash }}
                        </span>
                    </q-item-label>
                </q-item-section>

                <q-item-section side>
                    <div class="row items-center no-wrap q-gutter-xs">
                        <q-icon
                            :name="getIcon(version.state)"
                            :color="getColorFileState(version.state)"
                            size="xs"
                        >
                            <q-tooltip>
                                {{ getTooltip(version.state) }}
                            </q-tooltip>
                        </q-icon>
                        <q-btn
                            flat
                            dense
                            round
                            icon="sym_o_download"
                            :disable="!isDownloadable(version)"
                            :aria-label="`Download version ${version.versionNumber}`"
                            @click="() => void download(version)"
                        >
                            <q-tooltip>
                                {{
                                    isDownloadable(version)
                                        ? `Download v${version.versionNumber}`
                                        : 'This version is not available for download'
                                }}
                            </q-tooltip>
                        </q-btn>
                    </div>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>

<script setup lang="ts">
import type { FileVersionDto } from '@kleinkram/api-dto/types/file/file-version.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FileState } from '@kleinkram/shared';
import { Notify } from 'quasar';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import {
    _downloadFile,
    getColorFileState,
    getIcon,
    getTooltip,
} from 'src/services/generic';
import { computed } from 'vue';

const properties = defineProps<{ file: FileWithTopicDto }>();

/** Newest first, matching the order the API returns them in. */
const versions = computed<FileVersionDto[]>(() =>
    (properties.file.versions ?? []).toSorted(
        (a, b) => b.versionNumber - a.versionNumber,
    ),
);

const activeVersionUuid = computed(
    () => properties.file.versionUuid ?? properties.file.activeVersion?.uuid,
);

const isDownloadable = (version: FileVersionDto): boolean =>
    !(
        [FileState.LOST, FileState.UPLOADING, FileState.CANCELED] as FileState[]
    ).includes(version.state);

const download = async (version: FileVersionDto): Promise<void> => {
    try {
        await _downloadFile(
            properties.file.uuid,
            properties.file.filename,
            version.uuid,
        );
    } catch (error) {
        console.error(error);
        Notify.create({
            message: `Failed to download version ${version.versionNumber.toString()}`,
            color: 'negative',
            icon: 'sym_o_warning',
        });
    }
};
</script>
