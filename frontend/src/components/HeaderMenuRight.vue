<template>
    <q-tabs>
        <q-route-tab :to="ROUTES.LOGIN.path" v-if="!is_authenticated || !user">
            Sign in
        </q-route-tab>

        <div class="flex row justify-end" v-else style="height: 56px">
            <q-btn flat color="white" class="q-pa-none">
                <div
                    style="
                        background-color: #0f62fe;
                        border-radius: 4px 0 0 4px;
                    "
                >
                    <q-icon
                        name="sym_o_add"
                        class="q-mx-xs"
                        style="height: 36px"
                    />
                    <span class="q-mr-md"> New </span>
                </div>
                <q-separator
                    vertical
                    style="background-color: white; width: 1.2px"
                />

                <q-icon
                    style="
                        background-color: #0f62fe;
                        height: 36px;
                        border-radius: 0 4px 4px 0;
                    "
                    name="sym_o_arrow_drop_down"
                    class="q-my-sm"
                />

                <q-menu auto-close style="width: 280px">
                    <q-list>
                        <create-tag-type-dialog-opener>
                            <q-item clickable>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_sell" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label
                                        >Create New Tag Type
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </create-tag-type-dialog-opener>
                        <create-project-dialog-opener>
                            <q-item clickable>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_tactic" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label
                                        >Create New Project
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </create-project-dialog-opener>
                        <create-mission-dialog-opener>
                            <q-item clickable>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_explore" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label
                                        >Create New Mission
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </create-mission-dialog-opener>
                        <create-file-dialog-opener>
                            <q-item clickable>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_note_add" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label>Upload New File</q-item-label>
                                </q-item-section>
                            </q-item>
                        </create-file-dialog-opener>
                    </q-list>
                </q-menu>
            </q-btn>

            <div style="margin: auto 10px auto 30px">
                <q-btn
                    round
                    flat
                    color="grey-8"
                    :to="ROUTES.UPLOAD.path"
                    icon="sym_o_export_notes"
                    @mouseover="showOverlay = true"
                >
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
                        :offset="[100, 40]"
                        style="min-width: 600px"
                    >
                        <q-card>
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
                                                size="20px"
                                                v-if="progress !== 100"
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
                                <q-item v-for="upload in uploads">
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
                            </q-card-section>
                        </q-card>
                    </q-menu>
                </q-btn>

                <q-btn
                    href="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
                    round
                    flat
                    color="grey-8"
                    target="_blank"
                    icon="sym_o_help"
                >
                    <q-tooltip> Support</q-tooltip>
                </q-btn>
            </div>

            <div style="margin: auto 0">
                <q-btn
                    round
                    flat
                    :style="
                        user.role === USER_ROLES.ADMIN
                            ? 'border: 3px solid red'
                            : ''
                    "
                >
                    <q-avatar
                        size="32px"
                        v-if="!!user['avatarUrl'] && user['avatarUrl'] !== ''"
                    >
                        <img
                            :src="user['avatarUrl']"
                            referrerpolicy="no-referrer"
                            alt="avatar"
                        />
                    </q-avatar>

                    <q-avatar size="36px" v-else>
                        <q-icon name="sym_o_account_circle" />
                    </q-avatar>

                    <q-menu auto-close style="width: 280px">
                        <q-list>
                            <q-item
                                clickable
                                v-close-popup
                                @click="navigateTo(ROUTES.USER_PROFILE.path)"
                            >
                                <q-item-section avatar>
                                    <q-icon name="sym_o_person" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-section
                                        >{{ user['name'] }}
                                    </q-item-section>
                                </q-item-section>
                            </q-item>
                            <q-separator />

                            <q-item disabled>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_storage" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label>Storage</q-item-label>
                                </q-item-section>
                            </q-item>

                            <q-item disabled>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_settings" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label>Settings</q-item-label>
                                </q-item-section>
                            </q-item>

                            <q-item
                                clickable
                                @click="logout"
                                class="text-error"
                            >
                                <q-item-section avatar>
                                    <q-icon name="sym_o_logout" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label>Log out</q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </div>
        </div>
    </q-tabs>
</template>

<script setup lang="ts">
import { getUser, isAuthenticated, logout } from 'src/services/auth';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import CreateProjectDialogOpener from 'components/buttonWrapper/CreateProjectDialogOpener.vue';
import CreateMissionDialogOpener from 'components/buttonWrapper/CreateMissionDialogOpener.vue';
import CreateTagTypeDialogOpener from 'components/buttonWrapper/CreateTagTypeDialogOpener.vue';
import CreateFileDialogOpener from 'components/buttonWrapper/CreateFileDialogOpener.vue';
import USER_ROLES from 'src/enums/USER_ROLES';
import { useIsUploading } from 'src/hooks/customQueryHooks';
import { computed, inject, Ref, ref } from 'vue';
import { FileUpload } from 'src/types/FileUpload';

const is_authenticated = await isAuthenticated();
const is_uploading = useIsUploading();

const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => getUser(),
    enabled: is_authenticated,
});

const uploads = inject('uploads') as Ref<Ref<FileUpload>[]>;

const uncompletedUploads = computed(() =>
    uploads.value.filter(
        (upload) => !upload.value.completed && upload.value.uploaded > 0,
    ),
);

const totalToUpload = computed(() =>
    uploads.value.reduce(
        (acc, upload) => acc + (upload.value.canceled ? 0 : upload.value.size),
        0,
    ),
);
const totalUploaded = computed(() =>
    uploads.value.reduce(
        (acc, upload) =>
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
            (acc, upload) => acc + upload.value.speed,
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
    return `${ave} min`;
});

const showOverlay = ref(false);
const $router = useRouter();
const navigateTo = (path: string) => {
    $router.push(path);
};
</script>
