<template>
    <div class="row">
        <div class="admin-action">
            <q-btn
                label="Reset S3 Tagging"
                class="button-border bg-button-primary full-width admin-action__btn"
                icon="sym_o_sell"
                flat
                @click="resetS3Tagging"
            />
            <div class="help-text q-pt-sm">
                This will delete the S3 tags for all files in the system and
                then regenerate them based on the current DB state. This action
                cannot be undone. There is no confirmation!
            </div>
        </div>
        <div class="admin-action">
            <q-btn
                label="Recompute File Sizes"
                class="button-border bg-button-primary full-width admin-action__btn"
                icon="sym_o_expand"
                flat
                @click="resetFileSizes"
            />
            <div class="help-text q-pt-sm">
                This will recompute the file sizes in the database by asking S3
                for the size of each file. This action cannot be undone. There
                is no confirmation!
            </div>
        </div>

        <div class="admin-action">
            <q-btn
                label="Recalculate Hashes"
                class="button-border bg-button-primary full-width admin-action__btn"
                icon="sym_o_fingerprint"
                flat
                @click="recalculateHashes"
            />
            <div class="help-text q-pt-sm">
                This will extract the MD5 hash from the file (from S3) and store
                it in the database. This action cannot be undone. There is no
                confirmation!
            </div>
        </div>

        <div class="admin-action">
            <q-btn
                label="Fix Missing Topics"
                class="button-border bg-button-primary full-width admin-action__btn"
                icon="sym_o_topic"
                flat
                @click="reextractTopics"
            />
            <div class="help-text q-pt-sm">
                Finds all healthy .bag files that have 0 topics and re-runs
                metadata extraction (without conversion).
            </div>
        </div>

        <div class="admin-action">
            <q-btn
                label="Backfill Recording Times"
                class="button-border bg-button-primary full-width admin-action__btn"
                icon="sym_o_schedule"
                flat
                @click="backfillRecordingTimes"
            />
            <div class="help-text q-pt-sm">
                Reads the first and last message time from files that do not
                know their recording window yet, so that the start date stops
                showing the upload time. Also runs hourly on its own.
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import type {
    BackfillRecordingTimesResponseDto,
    RecalculateHashesResponseDto,
} from '@kleinkram/api-dto';
import { useQuasar } from 'quasar';
import axios from 'src/api/axios';

const $q = useQuasar();

async function resetS3Tagging(): Promise<void> {
    await axios.post('file/resetS3Tags');

    $q.notify({
        message: 'Resetting S3 tagging started',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}

async function resetFileSizes(): Promise<void> {
    await axios.post('file/recomputeFileSizes');

    $q.notify({
        message: 'Recomputing file sizes started',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}

async function recalculateHashes(): Promise<void> {
    const { data } = await axios.post<RecalculateHashesResponseDto>(
        'files/maintenance/recalculate-hashes',
    );

    $q.notify({
        message: `Recalculating hashes started. ${String(data.fileCount)} files to process`,
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}

async function backfillRecordingTimes(): Promise<void> {
    const { data } = await axios.post<BackfillRecordingTimesResponseDto>(
        'files/maintenance/backfill-recording-times',
    );

    $q.notify({
        message: `Recording time backfill started. ${String(data.fileCount)} files queued.`,
        color: 'positive',
        position: 'bottom',
        timeout: 3000,
    });
}

async function reextractTopics(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data } = await axios.post('files/reextractTopics');

    $q.notify({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
        message: `Topic extraction started. ${data.count} files queued.`,
        color: 'positive',
        position: 'bottom',
        timeout: 3000,
    });
}
</script>

<style scoped>
/*
 * A gutter on the row rather than on the blocks themselves, so that the
 * maintenance blocks keep their spacing once there are more of them than fit
 * on a single line.
 */
.row {
    gap: 24px;
}

.admin-action {
    width: 300px;
}

/*
 * Below the desktop breakpoint the fixed-width maintenance blocks are stacked
 * and span the full width instead of overflowing the row.
 */
@media (max-width: 1023px) {
    .admin-action {
        width: 100%;
    }

    .admin-action__btn {
        min-height: 44px;
    }
}
</style>
