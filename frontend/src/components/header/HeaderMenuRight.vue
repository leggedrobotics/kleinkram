<template>
    <q-tabs>
        <q-route-tab v-if="!user" :to="ROUTES.LOGIN.path">
            Sign in
        </q-route-tab>

        <div v-else class="flex row justify-end" style="height: 56px">
            <header-create-new-menu />

            <div
                style="margin: auto 10px auto 30px"
                @click="showOverlay = true"
            >
                <q-btn round flat color="grey-8" icon="sym_o_export_notes">
                    <q-tooltip>Processing Uploads</q-tooltip>
                    <q-linear-progress
                        v-if="is_uploading"
                        indeterminate
                        size="4px"
                        color="blue"
                        style="position: absolute; top: 35px; width: 30px"
                    />
                    <q-menu
                        v-model="showOverlay"
                        :offset="[110, 20]"
                        style="width: 400px; overflow: hidden"
                    >
                        <div style="width: 400px">
                            <q-card-section
                                style="
                                    padding-bottom: 5px;
                                    padding-top: 4px;
                                    max-height: 40px;
                                "
                            >
                                <q-item style="padding-bottom: 0">
                                    <q-item-section>
                                        <b>File Upload</b>
                                    </q-item-section>
                                </q-item>
                            </q-card-section>

                            <q-card-section
                                class="q-py-xs"
                                style="max-height: 40px"
                            >
                                <q-item style="padding-top: 0">
                                    <q-item-section>
                                        <div class="row items-center">
                                            <q-spinner
                                                v-if="progress !== 100"
                                                size="20px"
                                            />
                                            <span class="q-ml-sm"
                                                >{{ Math.round(progress) }}% ({{
                                                    timeEstimated
                                                }})</span
                                            >
                                        </div>
                                    </q-item-section>
                                </q-item>
                            </q-card-section>
                            <q-card-section class="q-py-xs">
                                <q-item>
                                    <q-item-section>
                                        Don't close this tab while files are
                                        uploading
                                    </q-item-section>
                                </q-item>
                                <q-item
                                    v-for="upload in uploads_without_completed.splice(
                                        0,
                                        5,
                                    )"
                                    :key="upload.value.uuid"
                                >
                                    <div class="row items-center">
                                        <q-icon
                                            name="sym_o_upload_file"
                                            size="3em"
                                        />
                                        <q-item-section>
                                            {{ upload.value.name }}
                                            <br />
                                            <p v-if="!upload.value.canceled">
                                                {{
                                                    Math.round(
                                                        upload.value.getProgress() *
                                                            100,
                                                    )
                                                }}%
                                            </p>
                                            <i v-else> Upload Canceled </i>
                                        </q-item-section>
                                    </div>
                                </q-item>

                                <span
                                    v-if="uploads_without_completed.length > 5"
                                >
                                    <q-item>
                                        <q-item-section>
                                            <span
                                                >And
                                                {{
                                                    uploads_without_completed.length -
                                                    5
                                                }}
                                                more</span
                                            >
                                        </q-item-section>
                                    </q-item>
                                </span>
                            </q-card-section>

                            <div
                                style="
                                    width: 100%;
                                    display: flex;
                                    margin-bottom: 8px;
                                "
                            >
                                <q-btn
                                    flat
                                    full-width
                                    outline
                                    style="margin: 8px auto; width: 200px"
                                    class="button-border"
                                    color="grey-8"
                                    label="Open Pending Uploads"
                                    :to="ROUTES.UPLOAD.path"
                                    @click="showOverlay = false"
                                />
                            </div>
                        </div>
                    </q-menu>
                </q-btn>

                <documentation-icon />
            </div>

            <header-profile-menu />
        </div>
    </q-tabs>
</template>

<script setup lang="ts">
import ROUTES from 'src/router/routes';
import { useQueryClient } from '@tanstack/vue-query';
import { useIsUploading, useUser } from 'src/hooks/customQueryHooks';
import { computed, inject, ref, watch } from 'vue';
import HeaderCreateNewMenu from 'components/header/HeaderCreateNewMenu.vue';
import HeaderProfileMenu from 'components/header/HeaderProfileMenu.vue';
import DocumentationIcon from 'components/DocumentationIcon.vue';

const is_uploading = useIsUploading();
const { data: user } = useUser();

// watch changes of is_uploading and invalidate queries
const queryClient = useQueryClient();
watch(is_uploading, () =>
    queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'files',
    }),
);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const uploads = inject('uploads')!;

const uploads_without_completed = computed(() =>
    uploads.value.filter((upload) => upload.value.getProgress() < 1),
);

const uncompletedUploads = computed(() =>
    uploads.value.filter(
        (upload) => !upload.value.completed && upload.value.uploaded > 0,
    ),
);

const totalToUpload = computed(() =>
    uploads.value.reduce(
        (acc: any, upload: any) =>
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            acc + (upload.value.canceled ? 0 : upload.value.size),
        0,
    ),
);
const totalUploaded = computed(() =>
    uploads.value.reduce(
        (acc: any, upload: any) =>
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            acc + (upload.value.canceled ? 0 : upload.value.uploaded),
        0,
    ),
);
const progress = computed(() =>
    totalToUpload.value === 0
        ? 100
        : (totalUploaded.value / totalToUpload.value) * 100,
);

const averageUploadSpeed = computed(() => {
    if (uncompletedUploads.value.length === 0) return 0;
    return (
        uncompletedUploads.value.reduce(
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            (acc: any, upload: any) => acc + upload.value.speed,
            0,
        ) / uncompletedUploads.value.length
    );
});
const timeEstimated = computed(() => {
    const remainingSize = totalToUpload.value - totalUploaded.value;
    if (remainingSize === 0) return '0 min';
    if (averageUploadSpeed.value === 0) return 'Calculating...';
    const remainingTime = remainingSize / averageUploadSpeed.value;
    const ave = Math.round(remainingTime / 60);
    return `${ave.toString()} min`;
});

const showOverlay = ref(false);
</script>
