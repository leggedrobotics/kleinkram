<template>
    <div class="q-pa-md">
        <div class="row q-col-gutter-md">
            <!-- State Info -->
            <div class="col-6">
                <AppInput label="State" :model-value="action.state" readonly>
                    <template
                        v-if="
                            action.state === ActionState.PROCESSING ||
                            action.state === ActionState.STARTING
                        "
                        #append
                    >
                        <q-spinner color="primary" size="1em" />
                    </template>
                </AppInput>
            </div>
            <div class="col-6">
                <AppInput
                    label="State Reason"
                    :model-value="action.stateCause || 'N/A'"
                    readonly
                />
            </div>

            <!-- Execution Info -->
            <div class="col-6">
                <AppInput
                    label="Submitted By"
                    :model-value="action.creator?.name"
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Submitted At"
                    :model-value="
                        action.createdAt ? formatDate(action.createdAt) : 'N/A'
                    "
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Last Updated At"
                    :model-value="
                        action.updatedAt ? formatDate(action.updatedAt) : 'N/A'
                    "
                    readonly
                />
            </div>
            <div class="col-6">
                <ActionRuntime :action="action" />
            </div>
            <div class="col-6">
                <AppInput
                    label="Project / Mission"
                    :model-value="`${action.mission?.project?.name} / ${action.mission?.name}`"
                    readonly
                >
                    <template #append>
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_open_in_new"
                            color="grey-7"
                            @click.stop="openMission"
                        >
                            <q-tooltip>Go to Mission</q-tooltip>
                        </q-btn>
                    </template>
                </AppInput>
            </div>

            <div class="col-12">
                <q-separator class="q-my-sm" />
            </div>

            <!-- Artifacts -->
            <div class="col-12">
                <div class="text-h6 q-mb-sm">
                    Artifact Files
                    <span class="text-caption text-grey-6 q-ml-sm">
                        (Artifacts are stored for 3 months)
                    </span>
                </div>
                <div class="row items-center q-gutter-x-md">
                    <q-btn
                        v-if="action.artifacts === ArtifactState.UPLOADED"
                        label="Download Artifacts"
                        unelevated
                        class="bg-button-secondary text-on-color"
                        icon="sym_o_download"
                        :disable="isExpired"
                        @click="openArtifact"
                    >
                        <q-tooltip v-if="isExpired">
                            Artifacts are only available for 3 months.
                        </q-tooltip>
                    </q-btn>
                    <div v-else class="text-grey-7">
                        {{ artifactStateText }}
                    </div>
                    <div
                        v-if="action.artifactSize"
                        class="text-caption text-grey-7"
                    >
                        {{ formatBytes(action.artifactSize) }}
                    </div>
                </div>
                <div v-if="showArtifactTree" class="q-mt-md">
                    <ArtifactFileTree :files="action.artifactFiles || []" />
                </div>
            </div>

            <div class="col-12">
                <q-separator class="q-my-sm" />
            </div>

            <!-- Technical Details -->
            <div class="col-12 text-h6">Technical Details</div>

            <div class="col-6">
                <AppInput
                    label="Docker Image"
                    :model-value="action.template.imageName"
                    readonly
                >
                    <template v-if="dockerHubUrl" #append>
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_open_in_new"
                            color="grey-7"
                            @click.stop="openDockerHub"
                        >
                            <q-tooltip>View on Docker Hub</q-tooltip>
                        </q-btn>
                    </template>
                </AppInput>
            </div>

            <div class="col-6">
                <AppInput
                    label="Image ID"
                    :model-value="action.image.sha || 'N/A'"
                    readonly
                >
                    <template v-if="action.image.sha" #append>
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_content_copy"
                            color="grey-7"
                            @click.stop="copyImageSha"
                        >
                            <q-tooltip>Copy Image ID</q-tooltip>
                        </q-btn>
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_help"
                            color="grey-7"
                        >
                            <q-tooltip>
                                The image ID is a hash of the local image JSON
                                configuration.
                            </q-tooltip>
                        </q-btn>
                    </template>
                </AppInput>
            </div>
            <div class="col-6">
                <AppInput
                    label="Image Source"
                    :model-value="
                        action.image.source
                            ? action.image.source === ImageSource.PULLED
                                ? 'Pulled from Registry'
                                : action.image.source ===
                                    ImageSource.LOCALLY_BUILT
                                  ? 'Locally Built (Override)'
                                  : action.image.source ===
                                      ImageSource.LOCALLY_BUILT_LOCAL_ONLY
                                    ? 'Locally Built (Local Only)'
                                    : 'Cached Locally'
                            : 'N/A'
                    "
                    readonly
                >
                    <template #append>
                        <q-btn
                            v-if="
                                action.image.source === ImageSource.CACHED ||
                                action.image.source ===
                                    ImageSource.LOCALLY_BUILT ||
                                action.image.source ===
                                    ImageSource.LOCALLY_BUILT_LOCAL_ONLY
                            "
                            flat
                            round
                            dense
                            icon="sym_o_info"
                            color="grey-7"
                        >
                            <q-tooltip>
                                <div
                                    v-if="
                                        action.image.source ===
                                        ImageSource.CACHED
                                    "
                                >
                                    Local image is up to date with remote image
                                    registry.
                                    <div v-if="action.image.localCreatedAt">
                                        Local Build Time:
                                        {{
                                            formatDate(
                                                action.image.localCreatedAt,
                                            )
                                        }}
                                    </div>
                                    <div v-if="action.image.remoteCreatedAt">
                                        Remote Build Time:
                                        {{
                                            formatDate(
                                                action.image.remoteCreatedAt,
                                            )
                                        }}
                                    </div>
                                </div>
                                <div
                                    v-else-if="
                                        action.image.source ===
                                        ImageSource.LOCALLY_BUILT
                                    "
                                >
                                    <div>Local image is newer than remote.</div>
                                    <div v-if="action.image.localCreatedAt">
                                        Local Build Time:
                                        {{
                                            formatDate(
                                                action.image.localCreatedAt,
                                            )
                                        }}
                                    </div>
                                    <div v-if="action.image.remoteCreatedAt">
                                        Remote Build Time:
                                        {{
                                            formatDate(
                                                action.image.remoteCreatedAt,
                                            )
                                        }}
                                    </div>
                                </div>
                                <div
                                    v-else-if="
                                        action.image.source ===
                                        ImageSource.LOCALLY_BUILT_LOCAL_ONLY
                                    "
                                >
                                    <div>
                                        Local image built locally but not found
                                        on remote registry.
                                    </div>
                                    <div v-if="action.image.localCreatedAt">
                                        Local Build Time:
                                        {{
                                            formatDate(
                                                action.image.localCreatedAt,
                                            )
                                        }}
                                    </div>
                                </div>
                            </q-tooltip>
                        </q-btn>
                    </template>
                </AppInput>
            </div>

            <div class="col-6">
                <AppInput
                    label="Repo Digest"
                    :model-value="action.image.repoDigests?.[0] || 'N/A'"
                    readonly
                >
                    <template v-if="action.image.repoDigests?.[0]" #append>
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_content_copy"
                            color="grey-7"
                            @click.stop="copyRepoDigest"
                        >
                            <q-tooltip>Copy Repo Digest</q-tooltip>
                        </q-btn>
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_help"
                            color="grey-7"
                        >
                            <q-tooltip>
                                The "digest" is a hash of the manifest of the
                                image in the Docker registry v2.
                            </q-tooltip>
                        </q-btn>
                    </template>
                </AppInput>
            </div>

            <div class="col-6">
                <AppInput
                    label="Runner CPU Model"
                    :model-value="action.worker?.cpuModel || 'N/A'"
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Runner Hostname"
                    :model-value="action.worker?.hostname || 'N/A'"
                    readonly
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { ActionState, ArtifactState, ImageSource } from '@kleinkram/shared';
import ActionRuntime from 'components/actions/action-runtime.vue';
import ArtifactFileTree from 'components/actions/artifact-file-tree.vue';
import AppInput from 'components/common/app-input.vue';
import { copyToClipboard } from 'quasar';
import ROUTES from 'src/router/routes';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ action: ActionDto }>();
const $router = useRouter();

const formatDate = (d: string | Date) => new Date(d).toLocaleString();

const formatBytes = (bytes: number, decimals = 2) => {
    if (!(bytes satisfies number)) return '0 Bytes';

    const k = 1024;
    const dm = Math.max(decimals, 0);
    const sizes = [
        'Bytes',
        'KiB',
        'MiB',
        'GiB',
        'TiB',
        'PiB',
        'EiB',
        'ZiB',
        'YiB',
    ];

    const index = Math.floor(Math.log(bytes) / Math.log(k));

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${Number.parseFloat((bytes / Math.pow(k, index)).toFixed(dm))} ${sizes[index]}`;
};

const artifactStateText = computed(() => {
    if (props.action.state === ActionState.UNPROCESSABLE) {
        return 'Action was unprocessable. No artifacts were generated.';
    }

    switch (props.action.artifacts) {
        case ArtifactState.UPLOADING: {
            return 'Uploading...';
        }
        case ArtifactState.ERROR: {
            return 'Error uploading artifacts';
        }
        case ArtifactState.AWAITING_ACTION: {
            return 'Waiting for action completion...';
        }
        default: {
            return 'N/A';
        }
    }
});

const showArtifactTree = computed(() => {
    if (!props.action.artifactFiles || props.action.artifactFiles.length === 0)
        return false;

    // In case where an empty out folder is the only artifact,
    // we should not display the artifact tree
    return !(
        props.action.artifactFiles.length === 1 &&
        (props.action.artifactFiles[0] === 'out' ||
            props.action.artifactFiles[0] === 'out/')
    );
});

const isExpired = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!props.action.createdAt) return false;
    const created = new Date(props.action.createdAt);
    const now = new Date();
    // 3 months ago
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    return created < threeMonthsAgo;
});

const openArtifact = (): void => {
    if (props.action.artifactUrl) {
        window.open(props.action.artifactUrl, '_blank');
    }
};

const openMission = async (): Promise<void> => {
    await $router.push({
        name: ROUTES.FILES.routeName,
        params: {
            projectUuid: props.action.mission.project.uuid,
            missionUuid: props.action.mission.uuid,
        },
    });
};

const openDockerHub = () => {
    if (dockerHubUrl.value) {
        window.open(dockerHubUrl.value, '_blank');
    }
};

const dockerHubUrl = computed(() => {
    const image = props.action.template.imageName;
    if (
        image.includes('localhost') ||
        image.includes(':5000') ||
        image.includes('ghcr.io')
    )
        return '';

    const parts = image.split('/');
    if (parts.length === 1 && parts[0]) {
        // Official image, e.g. "ubuntu" -> https://hub.docker.com/_/ubuntu
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return `https://hub.docker.com/_/${parts[0].split(':')[0]}`;
    }
    if (parts.length === 2 && parts[0] && parts[1]) {
        // User image, e.g. "rslethz/kleinkram" -> https://hub.docker.com/r/rslethz/kleinkram
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return `https://hub.docker.com/r/${parts[0]}/${parts[1].split(':')[0]}`;
    }
    return '';
});

const copyImageSha = () => {
    void copyToClipboard(props.action.image.sha || '');
};

const copyRepoDigest = () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    void copyToClipboard(props.action.image.repoDigests?.[0] ?? '');
};
</script>
