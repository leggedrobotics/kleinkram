<template>
    <section class="storage" aria-labelledby="storage-heading">
        <div>
            <h2 id="storage-heading" class="storage__heading">Storage</h2>
            <p v-if="!isAdmin" class="storage__scope">
                Only projects you can access.
            </p>
        </div>

        <div
            class="storage__tiles"
            :class="{ 'storage__tiles--three': !isAdmin }"
        >
            <template v-if="isLoading">
                <q-skeleton
                    v-for="index in isAdmin ? 4 : 3"
                    :key="index"
                    type="rect"
                    height="96px"
                    class="storage__tile"
                />
            </template>
            <template v-else>
                <div class="storage__tile">
                    <div class="storage__tile-label">Disk</div>
                    <div class="storage__tile-value">
                        {{ formatSize(diskUsed) }}
                    </div>
                    <div class="storage__tile-sub">
                        <template v-if="capacity > 0">
                            of {{ formatSize(capacity) }} · {{ diskPercent }}%
                        </template>
                        <template v-else>capacity unknown</template>
                    </div>
                    <div
                        v-if="capacity > 0"
                        class="storage__meter"
                        role="meter"
                        aria-label="Used disk space"
                        :aria-valuenow="diskPercent"
                        aria-valuemin="0"
                        aria-valuemax="100"
                    >
                        <div :style="{ width: `${String(diskPercent)}%` }" />
                    </div>
                    <div v-if="inodeTotal > 0" class="storage__inodes">
                        <span>Inodes {{ inodePercent }}%</span>
                        <div
                            class="storage__meter storage__meter--small"
                            role="meter"
                            aria-label="Used inodes"
                            :aria-valuenow="inodePercent"
                            aria-valuemin="0"
                            aria-valuemax="100"
                        >
                            <div
                                :style="{ width: `${String(inodePercent)}%` }"
                            />
                        </div>
                    </div>
                </div>

                <div class="storage__tile">
                    <div class="storage__tile-label">Last 30 days</div>
                    <div class="storage__tile-value">
                        +{{ formatSize(insights?.last30Days.bytes ?? 0) }}
                    </div>
                    <div class="storage__tile-sub">
                        {{ formatCount(insights?.last30Days.fileCount ?? 0) }}
                        {{
                            insights?.last30Days.fileCount === 1
                                ? 'file'
                                : 'files'
                        }}
                        uploaded
                    </div>
                </div>

                <!-- a projection for the whole system: admins only -->
                <div v-if="isAdmin" class="storage__tile">
                    <div class="storage__tile-label">Full in</div>
                    <div class="storage__tile-value">{{ fullIn.value }}</div>
                    <div class="storage__tile-sub">{{ fullIn.reason }}</div>
                </div>

                <div class="storage__tile">
                    <div class="storage__tile-label">Files</div>
                    <div class="storage__tile-value">
                        {{ formatSize(insights?.totals.bytes ?? 0) }}
                    </div>
                    <div class="storage__tile-sub">
                        {{ plural(insights?.totals.fileCount ?? 0, 'file') }}
                        in
                        {{
                            plural(
                                insights?.totals.projectCount ?? 0,
                                'project',
                            )
                        }}
                    </div>
                </div>
            </template>
        </div>

        <q-skeleton
            v-if="isLoading"
            type="rect"
            height="240px"
            class="storage__card"
        />
        <div v-else-if="isError" class="storage__card storage__empty">
            Could not load the storage insights.
        </div>
        <div v-else-if="isEmpty" class="storage__card storage__empty">
            No files are stored yet.
        </div>
        <template v-else-if="insights">
            <div class="storage__card">
                <h3 class="storage__card-title">Growth</h3>
                <p class="storage__card-sub">
                    Stored file data at the end of each month.
                </p>
                <storage-growth-chart
                    :monthly="insights.monthly"
                    :monthly-rate="monthlyRate"
                />
            </div>

            <div class="storage__columns">
                <div class="storage__card">
                    <h3 class="storage__card-title">By project</h3>
                    <p class="storage__card-sub">
                        Click a row to open the project.
                    </p>
                    <storage-bar-list
                        :items="projectItems"
                        :total="insights.totals.bytes"
                    />
                </div>
                <div class="storage__card">
                    <h3 class="storage__card-title">By file type</h3>
                    <p class="storage__card-sub">
                        .mcap includes converted copies of .bag files.
                    </p>
                    <storage-bar-list
                        :items="typeItems"
                        :total="insights.totals.bytes"
                    />
                </div>
            </div>

            <div :class="{ storage__columns: isAdmin }">
                <div class="storage__card">
                    <h3 class="storage__card-title">Largest missions</h3>
                    <p class="storage__card-sub">Top 5 across all projects.</p>
                    <storage-bar-list
                        :items="missionItems"
                        :total="insights.totals.bytes"
                    />
                </div>

                <!-- admins only: the endpoint answers 403 to everyone else -->
                <div v-if="isAdmin" class="storage__card">
                    <h3 class="storage__card-title">By uploader</h3>
                    <p class="storage__card-sub">
                        Stored data per user who uploaded it.
                    </p>
                    <q-skeleton
                        v-if="uploadersLoading"
                        type="rect"
                        height="160px"
                    />
                    <div v-else-if="uploadersError" class="storage__empty">
                        Could not load the uploaders.
                    </div>
                    <div
                        v-else-if="uploaderItems.length === 0"
                        class="storage__empty"
                    >
                        No uploads yet.
                    </div>
                    <storage-bar-list
                        v-else
                        :items="uploaderItems"
                        :total="uploaders?.totalBytes ?? 0"
                    />
                </div>
            </div>
        </template>
    </section>
</template>

<script setup lang="ts">
/**
 * Where the stored data comes from and how fast it grows: used space,
 * recent uploads, when the disk is full at the current rate, and the
 * largest projects, file types and missions.
 */
import { UserRole } from '@kleinkram/shared';
import type { StorageBarItem } from 'components/system/storage-bar-item';
import StorageBarList from 'components/system/storage-bar-list.vue';
import StorageGrowthChart from 'components/system/storage-growth-chart.vue';
import {
    useStorageInsights,
    useStorageOverview,
    useStorageUploaders,
    useUser,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatSize, formatTimeAgo } from 'src/services/general-formatting';
import { computed } from 'vue';

const {
    data: insights,
    isLoading: insightsLoading,
    isError,
} = useStorageInsights();
const { data: storage, isLoading: storageLoading } = useStorageOverview();

/** Stored data per uploader is shown to admins only */
const { data: me } = useUser();
const isAdmin = computed(() => me.value?.role === UserRole.ADMIN);
const {
    data: uploaders,
    isLoading: uploadersLoading,
    isError: uploadersError,
} = useStorageUploaders(isAdmin);

const isLoading = computed(() => insightsLoading.value || storageLoading.value);
const isEmpty = computed(() => (insights.value?.totals.fileCount ?? 0) === 0);

/** The disk as a whole: files plus the storage system's own overhead */
const capacity = computed(() => storage.value?.totalBytes ?? 0);
const diskUsed = computed(() => storage.value?.usedBytes ?? 0);
const percentOf = (used: number, total: number): number =>
    total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
const diskPercent = computed(() => percentOf(diskUsed.value, capacity.value));
const inodeTotal = computed(() => storage.value?.totalInodes ?? 0);
const inodePercent = computed(() =>
    percentOf(storage.value?.usedInodes ?? 0, inodeTotal.value),
);

/** Average bytes added per month over the last 90 days */
const monthlyRate = computed(() => (insights.value?.last90Days.bytes ?? 0) / 3);

/** Disk free space ÷ the monthly rate of file uploads */
const monthsToFull = computed<number | undefined>(() => {
    if (capacity.value <= 0 || monthlyRate.value <= 0) return;
    return Math.max(capacity.value - diskUsed.value, 0) / monthlyRate.value;
});

const ESTIMATE = 'estimate · disk free ÷ upload rate';

const fullIn = computed(() => {
    if (capacity.value <= 0)
        return { value: '—', reason: 'disk capacity unknown' };
    if (monthlyRate.value <= 0)
        return { value: '—', reason: 'no uploads in the last 90 days' };
    const months = monthsToFull.value ?? 0;
    if (months < 1) return { value: '< 1 month', reason: ESTIMATE };
    if (months > 120) return { value: '> 10 years', reason: ESTIMATE };
    if (months >= 24) {
        return {
            value: `≈ ${String(Math.round(months / 12))} years`,
            reason: ESTIMATE,
        };
    }
    const rounded = Math.round(months);
    return {
        value: `≈ ${String(rounded)} ${rounded === 1 ? 'month' : 'months'}`,
        reason: ESTIMATE,
    };
});

const formatCount = (count: number): string => count.toLocaleString('en-US');
const plural = (count: number, word: string): string =>
    `${formatCount(count)} ${word}${count === 1 ? '' : 's'}`;

const projectItems = computed<StorageBarItem[]>(() => {
    if (!insights.value) return [];
    const items: StorageBarItem[] = insights.value.byProject.map((project) => ({
        key: project.uuid,
        name: project.name,
        sub: plural(project.missionCount, 'mission'),
        bytes: project.bytes,
        to: {
            name: ROUTES.MISSIONS.routeName,
            params: { projectUuid: project.uuid },
        },
    }));
    const other = insights.value.otherProjects;
    if (other)
        items.push({
            key: 'other',
            name: `Other (${plural(other.projectCount, 'project')})`,
            bytes: other.bytes,
            other: true,
        });
    return items;
});

const extension = (type: string): string => `.${type.toLowerCase()}`;

const typeItems = computed<StorageBarItem[]>(() =>
    (insights.value?.byType ?? []).map((type) =>
        type.type === 'OTHER'
            ? {
                  key: 'other',
                  name: 'Other',
                  sub: type.types.map((t) => extension(t)).join(' '),
                  bytes: type.bytes,
                  other: true,
              }
            : {
                  key: type.type,
                  name: extension(type.type),
                  sub: plural(type.fileCount, 'file'),
                  bytes: type.bytes,
              },
    ),
);

const uploaderItems = computed<StorageBarItem[]>(() => {
    if (!uploaders.value) return [];
    const items: StorageBarItem[] = uploaders.value.uploaders.map(
        (uploader) => ({
            key: uploader.uuid,
            name: uploader.name,
            sub: `${plural(uploader.fileCount, 'file')} · last upload ${formatTimeAgo(uploader.lastUploadAt)}`,
            bytes: uploader.bytes,
        }),
    );
    const other = uploaders.value.other;
    if (other)
        items.push({
            key: 'other',
            name: `Other (${plural(other.userCount, 'user')})`,
            bytes: other.bytes,
            other: true,
        });
    return items;
});

const missionItems = computed<StorageBarItem[]>(() =>
    (insights.value?.largestMissions ?? []).map((mission) => ({
        key: mission.missionUuid,
        name: mission.missionName,
        sub: mission.projectName,
        bytes: mission.bytes,
        to: {
            name: ROUTES.FILES.routeName,
            params: {
                projectUuid: mission.projectUuid,
                missionUuid: mission.missionUuid,
            },
        },
    })),
);
</script>

<style scoped>
/* $text-primary on white cards, $text-secondary for helper lines */
.storage {
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: #161616;
}

.storage__heading {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.75rem;
}

.storage__tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
}

/* without "Full in" (non-admins), three tiles fill the row */
.storage__tiles--three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.storage__scope {
    margin: 2px 0 0;
    color: #525252;
    font-size: 12px;
}

.storage__tile,
.storage__card {
    min-width: 0;
    padding: 16px;
    border-radius: 4px;
    background: #ffffff;
}

.storage__tile-label,
.storage__tile-sub,
.storage__card-sub {
    color: #525252;
    font-size: 12px;
}

.storage__tile-value {
    margin: 4px 0 2px;
    font-size: 24px;
    font-weight: 600;
    line-height: 1.25;
}

/* $border-subtle track, $link-primary fill */
.storage__meter {
    height: 6px;
    margin-top: 8px;
    overflow: hidden;
    border-radius: 3px;
    background: #e0e0e0;
}

.storage__meter > div {
    height: 100%;
    border-radius: 3px;
    background: #0f62fe;
}

.storage__inodes {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    color: #525252;
    font-size: 12px;
    white-space: nowrap;
}

.storage__meter--small {
    flex: 1;
    height: 4px;
    margin-top: 0;
}

.storage__card-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
}

.storage__card-sub {
    margin: 2px 0 12px;
}

.storage__columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.storage__empty {
    color: #525252;
}

/* below md: the tiles in two columns, the cards stacked */
@media (max-width: 1023px) {
    .storage__tiles {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .storage__columns {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (max-width: 599px) {
    .storage__tiles {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
