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
                <AppInput
                    label="Runtime"
                    :model-value="runtimeString"
                    readonly
                />
            </div>

            <div class="col-12">
                <q-separator class="q-my-sm" />
            </div>

            <!-- Technical Details -->
            <div class="col-12 text-h6">Technical Details</div>

            <div class="col-6">
                <AppInput
                    label="Resolved Image Digest"
                    :model-value="
                        action.image.repoDigests?.[0] ||
                        action.image.sha ||
                        'N/A'
                    "
                    readonly
                />
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
                            color="primary"
                            @click.stop="openMission"
                        >
                            <q-tooltip>Go to Mission</q-tooltip>
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

            <div class="col-12">
                <q-separator class="q-my-sm" />
            </div>

            <!-- Artifacts -->
            <div class="col-12">
                <div class="text-subtitle2 q-mb-sm">
                    Artifact Files
                    <span class="text-caption text-grey-6 q-ml-sm">
                        (Artifacts are stored for 3 months)
                    </span>
                </div>
                <div class="row items-center q-gutter-x-md">
                    <q-btn
                        v-if="action.artifacts === ArtifactState.UPLOADED"
                        label="Open Artifacts"
                        unelevated
                        class="bg-button-secondary text-on-color"
                        icon="sym_o_link"
                        @click="openArtifact"
                    />
                    <div v-else class="text-grey-7">
                        {{ artifactStateText }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ActionDto } from '@api/types/actions/action.dto';
import { ActionState, ArtifactState } from '@common/enum';
import AppInput from 'components/common/app-input.vue';
import ROUTES from 'src/router/routes';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ action: ActionDto }>();
const $router = useRouter();

const formatDate = (d: string | Date) => new Date(d).toLocaleString();

const runtimeString = computed(() => {
    if (!props.action.createdAt || !props.action.updatedAt) return 'N/A';
    const start = new Date(props.action.createdAt).getTime();
    const end = new Date(props.action.updatedAt).getTime();
    return `${(end - start) / 1000} seconds`;
});

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
</script>
