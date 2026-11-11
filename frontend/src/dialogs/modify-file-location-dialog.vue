<template>
    <base-dialog ref="dialogRef">
        <template #title>
            Move or copy
            {{
                files.length === 1
                    ? files[0]?.filename
                    : `${files.length} files`
            }}
        </template>

        <template #content>
            <div class="column transfer-dialog">
                <div>
                    <div class="text-weight-bold q-mb-xs">Action</div>
                    <q-btn-toggle
                        v-model="mode"
                        no-caps
                        unelevated
                        toggle-color="button-primary"
                        color="white"
                        text-color="grey-9"
                        class="button-border"
                        :options="[
                            { label: 'Move', value: 'move' },
                            { label: 'Copy', value: 'copy' },
                        ]"
                    />
                    <div class="text-caption text-grey-7 q-mt-xs">
                        <template v-if="mode === 'move'">
                            The files leave
                            <b
                                >{{ mission.project.name }} /
                                {{ mission.name }}</b
                            >.
                        </template>
                        <template v-else>
                            The originals stay in
                            <b
                                >{{ mission.project.name }} /
                                {{ mission.name }}</b
                            >. Kleinkram copies the data on the server; nothing
                            is downloaded.
                        </template>
                    </div>
                </div>

                <div class="row q-col-gutter-sm">
                    <div class="col-6">
                        <AppSelect
                            :model-value="targetProjectUuid"
                            :options="projects"
                            label="Project"
                            :required="true"
                            :loading="isProjectsLoading"
                            option-label="name"
                            option-value="uuid"
                            placeholder="Select Project"
                            searchable
                            @update:model-value="onProjectChange"
                        />
                    </div>
                    <div class="col-6">
                        <AppSelect
                            v-model="targetMissionUuid"
                            :options="missionOptions"
                            label="Mission"
                            :required="true"
                            :disable="!targetProjectUuid"
                            :loading="isMissionsLoading"
                            option-label="name"
                            option-value="uuid"
                            placeholder="Select Mission"
                            searchable
                        >
                            <template #option="scope">
                                <q-item v-bind="scope.itemProps">
                                    <q-item-section
                                        :class="{
                                            'text-button-primary text-weight-medium':
                                                scope.opt.uuid === NEW_MISSION,
                                        }"
                                    >
                                        {{ scope.opt.name }}
                                    </q-item-section>
                                </q-item>
                            </template>
                        </AppSelect>
                    </div>
                </div>

                <div
                    v-if="mode === 'move' && isSameMission"
                    class="text-caption text-grey-7"
                    style="margin-top: -8px"
                >
                    The files are already in this mission. Pick another mission,
                    or choose Copy to duplicate them here.
                </div>

                <div v-if="isNewMission" class="new-mission q-pa-md">
                    <div class="new-mission__tag q-mb-sm">
                        NEW MISSION IN {{ selectedProject?.name }}
                    </div>
                    <q-input
                        v-model="newMissionName"
                        outlined
                        dense
                        autofocus
                        bg-color="white"
                        placeholder="Mission name"
                        :error="!!newMissionNameError"
                        :error-message="newMissionNameError"
                        hide-bottom-space
                    />
                    <div v-if="selectedProject" class="q-mt-md">
                        <SelectMissionMetadata
                            :metadata-values="metadataValues"
                            :project-uuid="selectedProject.uuid"
                            @update:metadata-values="updateMetadataValues"
                        />
                    </div>
                </div>

                <div>
                    <div class="text-weight-bold q-mb-xs">Files</div>
                    <q-list bordered separator class="rounded-borders">
                        <q-item
                            v-for="row in fileRows"
                            :key="row.file.uuid"
                            dense
                            :class="{ 'file-row--conflict': row.problem }"
                        >
                            <q-item-section>
                                <div class="row items-center no-wrap">
                                    <span
                                        class="file-row__name ellipsis"
                                        :class="{
                                            'text-strike text-grey-6':
                                                row.resolution.action ===
                                                'skip',
                                        }"
                                    >
                                        {{ row.file.filename }}
                                    </span>
                                    <q-space />
                                    <span
                                        v-if="isChecking"
                                        class="text-caption text-grey-6"
                                    >
                                        checking…
                                    </span>
                                    <span
                                        v-else-if="row.problem"
                                        class="text-caption text-warning-dark"
                                    >
                                        <q-icon name="sym_o_warning" />
                                        {{ row.problem }}
                                    </span>
                                    <span
                                        v-else-if="
                                            row.resolution.action === 'skip'
                                        "
                                        class="text-caption text-grey-6"
                                    >
                                        skipped
                                    </span>
                                    <span
                                        v-else
                                        class="text-caption text-positive"
                                    >
                                        <q-icon name="sym_o_check" />
                                        {{
                                            row.resolution.action === 'rename'
                                                ? 'ready, renamed'
                                                : 'ready'
                                        }}
                                    </span>
                                </div>
                                <div
                                    v-if="row.needsResolution"
                                    class="row items-center q-gutter-x-sm q-mt-xs"
                                >
                                    <q-btn
                                        v-for="option in resolutionOptions"
                                        :key="option.value"
                                        :label="option.label"
                                        size="sm"
                                        rounded
                                        unelevated
                                        no-caps
                                        :outline="
                                            row.resolution.action !==
                                            option.value
                                        "
                                        :color="
                                            row.resolution.action ===
                                            option.value
                                                ? 'button-primary'
                                                : 'grey-7'
                                        "
                                        @click="
                                            () =>
                                                setAction(
                                                    row.file,
                                                    option.value,
                                                )
                                        "
                                    />
                                    <q-input
                                        v-if="
                                            row.resolution.action === 'rename'
                                        "
                                        v-model="row.resolution.name"
                                        dense
                                        outlined
                                        bg-color="white"
                                        class="col file-row__rename"
                                        input-class="text-mono"
                                        @update:model-value="
                                            () => markManual(row.file)
                                        "
                                    />
                                </div>
                            </q-item-section>
                        </q-item>
                    </q-list>
                    <div class="text-caption text-grey-7 q-mt-xs">
                        Names are checked before anything changes. While a
                        conflict is unresolved, no file is
                        {{ mode === 'move' ? 'moved' : 'copied' }}.
                    </div>
                </div>

                <div v-if="cliCommand" class="cli-hint q-pa-sm">
                    <div class="row no-wrap items-start">
                        <code class="col cli-hint__code">{{ cliCommand }}</code>
                        <q-btn
                            flat
                            dense
                            size="sm"
                            icon="sym_o_content_copy"
                            @click="copyCliCommand"
                        >
                            <q-tooltip>Copy command</q-tooltip>
                        </q-btn>
                    </div>
                    <div
                        v-if="isNewMission"
                        class="text-caption text-grey-7 q-mt-xs"
                    >
                        On the command line, create the mission first with
                        <code>klein mission create</code>.
                    </div>
                </div>
            </div>
        </template>

        <template #actions>
            <div class="row items-center full-width">
                <span class="text-caption text-grey-7">
                    {{ includedFiles.length }}
                    {{ includedFiles.length === 1 ? 'file' : 'files' }} ·
                    {{ formatSize(includedSize) }}
                </span>
                <q-space />
                <q-btn
                    label="Cancel"
                    flat
                    class="q-mr-sm button-border"
                    @click="onDialogCancel"
                />
                <q-btn
                    :label="submitLabel"
                    class="bg-button-primary"
                    :loading="isPending"
                    :disable="!canSubmit || isPending"
                    @click="submit"
                />
            </div>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import {
    getNameValidationError,
    isValidFileName,
    splitFileName,
} from '@kleinkram/validation/frontend';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import AppSelect from 'components/common/app-select.vue';
import SelectMissionMetadata from 'components/select-mission-metadata.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { canCreateMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { formatSize } from 'src/services/general-formatting';
import { copyFiles, moveFiles } from 'src/services/mutations/file';
import { createMission } from 'src/services/mutations/mission';
import { existingFilenames } from 'src/services/queries/file';
import { computed, reactive, ref, watch } from 'vue';

type Mode = 'move' | 'copy';
type Action = 'keep' | 'rename' | 'skip';
interface Resolution {
    action: Action;
    name: string;
    /** set by the dialog to resolve a conflict, not by the user */
    auto?: boolean;
}

const NEW_MISSION = '__new_mission__';

const props = defineProps<{
    mission: MissionWithFilesDto;
    files: FileWithTopicDto[];
}>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const queryClient = useQueryClient();

const mode = ref<Mode>('move');
const targetProjectUuid = ref<string | undefined>(props.mission.project.uuid);
const targetMissionUuid = ref<string | undefined>(props.mission.uuid);

const {
    projects,
    missions,
    selectedProject,
    setProject,
    isProjectsLoading,
    isMissionsLoading,
} = useScopeSelection(targetProjectUuid, targetMissionUuid);

const onProjectChange = (value: string | null | undefined): void => {
    setProject(value ?? undefined);
};

const { data: permissions } = usePermissionsQuery();
const missionOptions = computed(() => {
    const options = missions.value.map((m) => ({ uuid: m.uuid, name: m.name }));
    if (
        targetProjectUuid.value &&
        canCreateMission(targetProjectUuid.value, permissions.value)
    ) {
        options.unshift({ uuid: NEW_MISSION, name: '+ New mission' });
    }
    return options;
});

// --- new mission -------------------------------------------------------
const isNewMission = computed(() => targetMissionUuid.value === NEW_MISSION);
const newMissionName = ref('');
const metadataValues = ref<Record<string, string>>({});
const newMissionNameError = computed(() =>
    newMissionName.value
        ? (getNameValidationError(newMissionName.value, 'Mission name') ?? '')
        : '',
);
const updateMetadataValues = (update: Record<string, string>): void => {
    metadataValues.value = update;
};
const isNewMissionValid = computed(
    () =>
        !!newMissionName.value &&
        !newMissionNameError.value &&
        (selectedProject.value?.requiredMetadataTypes ?? []).every(
            (type) => !!metadataValues.value[type.uuid],
        ),
);

// --- name conflicts ----------------------------------------------------
const resolutions = reactive<Record<string, Resolution>>(
    Object.fromEntries(
        props.files.map((file) => [
            file.uuid,
            { action: 'keep', name: file.filename },
        ]),
    ),
);

const resolutionOf = (file: FileWithTopicDto): Resolution =>
    resolutions[file.uuid] ?? { action: 'keep', name: file.filename };

const finalName = (file: FileWithTopicDto): string => {
    const resolution = resolutionOf(file);
    return resolution.action === 'rename' ? resolution.name : file.filename;
};

const isSameMission = computed(
    () => !isNewMission.value && targetMissionUuid.value === props.mission.uuid,
);

/** `name_1.ext` … `name_N.ext`, the names `suggestName` tries first */
const candidateNames = (file: FileWithTopicDto, count: number): string[] => {
    const { name, extension } = splitFileName(file.filename);
    return Array.from(
        { length: count },
        (_, index) => `${name}_${String(index + 1)}${extension}`,
    );
};

// The candidates are checked along with the names, so a suggested name is
// known to be free without another round trip in most cases.
const namesToCheck = computed(() =>
    [
        ...new Set(
            props.files.flatMap((file) => [
                file.filename,
                finalName(file),
                ...candidateNames(file, 5),
            ]),
        ),
    ]
        .filter(Boolean)
        .toSorted(),
);

// Moving into the current mission is not possible, so there is nothing to
// check. Copying into it is, and then every name clashes with its original.
const checkTarget = computed(() =>
    targetMissionUuid.value &&
    !isNewMission.value &&
    !(mode.value === 'move' && isSameMission.value)
        ? targetMissionUuid.value
        : undefined,
);

const { data: existingNames, isFetching: isChecking } = useQuery({
    queryKey: computed(() => [
        'existingNames',
        checkTarget.value,
        namesToCheck.value,
    ]),
    queryFn: () =>
        existingFilenames(checkTarget.value ?? '', namesToCheck.value),
    enabled: computed(() => !!checkTarget.value),
});

const existingSet = computed(
    () => new Set(checkTarget.value ? (existingNames.value ?? []) : []),
);

/** A free name like `name_1.ext` that clashes with nothing. */
const suggestName = (file: FileWithTopicDto, taken: Set<string>): string => {
    const { name, extension } = splitFileName(file.filename);
    for (let index = 1; index < 1000; index++) {
        const candidate = `${name}_${String(index)}${extension}`;
        if (!taken.has(candidate)) return candidate;
    }
    return file.filename;
};

// Files whose name is taken get a suggested new name, the user can change
// it or skip the file instead. Suggestions are undone once the conflict is
// gone, e.g. after picking another mission.
watch(
    [existingSet, checkTarget],
    () => {
        for (const file of props.files) {
            const resolution = resolutionOf(file);
            if (!resolution.auto) continue;
            // undo a suggestion once the conflict is gone, and replace one
            // that turned out to be taken itself
            if (
                !existingSet.value.has(file.filename) ||
                existingSet.value.has(resolution.name)
            ) {
                resolutions[file.uuid] = {
                    action: 'keep',
                    name: file.filename,
                };
            }
        }
        const taken = new Set([
            ...existingSet.value,
            ...props.files.map((file) => finalName(file)),
        ]);
        for (const file of props.files) {
            const resolution = resolutionOf(file);
            if (
                resolution.action === 'keep' &&
                existingSet.value.has(file.filename)
            ) {
                const suggestion = suggestName(file, taken);
                taken.add(suggestion);
                resolutions[file.uuid] = {
                    action: 'rename',
                    name: suggestion,
                    auto: true,
                };
            }
        }
    },
    { immediate: true },
);

const markManual = (file: FileWithTopicDto): void => {
    const resolution = resolutionOf(file);
    resolution.auto = false;
};

const includedFiles = computed(() =>
    props.files.filter((file) => resolutionOf(file).action !== 'skip'),
);
const includedSize = computed(() =>
    includedFiles.value.reduce((sum, file) => sum + file.size, 0),
);

const fileRows = computed(() => {
    const finalNames = includedFiles.value.map((file) => finalName(file));
    return props.files.map((file) => {
        const resolution = resolutionOf(file);
        const name = finalName(file);
        let problem = '';
        if (resolution.action !== 'skip') {
            if (
                resolution.action === 'rename' &&
                (!isValidFileName(name) ||
                    splitFileName(name).extension.toLowerCase() !==
                        splitFileName(file.filename).extension.toLowerCase())
            ) {
                problem = `invalid name, keep ${splitFileName(file.filename).extension}`;
            } else if (existingSet.value.has(name)) {
                problem = 'name taken in target';
            } else if (
                finalNames.indexOf(name) !== finalNames.lastIndexOf(name)
            ) {
                problem = 'same name as another file';
            }
        }
        return {
            file,
            resolution,
            problem,
            needsResolution:
                resolution.action !== 'keep' ||
                existingSet.value.has(file.filename),
        };
    });
});

const resolutionOptions: { label: string; value: Action }[] = [
    { label: 'Rename', value: 'rename' },
    { label: 'Skip', value: 'skip' },
];

const setAction = (file: FileWithTopicDto, action: Action): void => {
    const current = resolutionOf(file);
    resolutions[file.uuid] = {
        action,
        name:
            current.name === file.filename
                ? suggestName(file, existingSet.value)
                : current.name,
        auto: false,
    };
};

const canSubmit = computed(
    () =>
        !!targetMissionUuid.value &&
        !(mode.value === 'move' && isSameMission.value) &&
        (!isNewMission.value || isNewMissionValid.value) &&
        includedFiles.value.length > 0 &&
        !isChecking.value &&
        fileRows.value.every((row) => !row.problem),
);

const submitLabel = computed(() => {
    const verb = mode.value === 'move' ? 'Move' : 'Copy';
    const count = includedFiles.value.length;
    const files = `${String(count)} ${count === 1 ? 'file' : 'files'}`;
    return isNewMission.value
        ? `Create mission & ${verb.toLowerCase()}`
        : `${verb} ${files}`;
});

// --- CLI ---------------------------------------------------------------
/** Quotes an argument for a POSIX shell when it needs it. */
const shellQuote = (value: string): string =>
    /^[\w@%+=:,./-]+$/.test(value)
        ? value
        : `'${value.replaceAll("'", String.raw`'\''`)}'`;

const cliCommand = computed(() => {
    if (
        !targetMissionUuid.value ||
        includedFiles.value.length === 0 ||
        (mode.value === 'move' && isSameMission.value)
    )
        return '';
    const target = isNewMission.value
        ? `--to-project ${shellQuote(selectedProject.value?.name ?? '')} --to-mission ${shellQuote(newMissionName.value || 'NAME')}`
        : `--to-mission ${targetMissionUuid.value}`;
    const renames = includedFiles.value
        .filter((file) => resolutionOf(file).action === 'rename')
        .map(
            (file) =>
                ` --rename ${shellQuote(`${file.uuid}=${finalName(file)}`)}`,
        )
        .join('');
    const files = includedFiles.value.map((file) => file.uuid).join(' ');
    return `klein file ${mode.value} ${files} ${target}${renames}`;
});

const copyCliCommand = async (): Promise<void> => {
    await navigator.clipboard.writeText(cliCommand.value);
};

// --- submit ------------------------------------------------------------
const { mutate: submitMutation, isPending } = useMutation({
    mutationFn: async () => {
        let missionUuid = targetMissionUuid.value;
        if (!missionUuid) throw new Error('No mission selected');

        if (isNewMission.value) {
            const projectUuid = targetProjectUuid.value;
            if (!projectUuid) throw new Error('No project selected');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const created: { uuid: string } = await createMission(
                newMissionName.value,
                projectUuid,
                metadataValues.value,
            );
            missionUuid = created.uuid;
            // a failed transfer must not create the mission a second time
            await queryClient.invalidateQueries({
                predicate: (query) => query.queryKey[0] === 'missions',
            });
            targetMissionUuid.value = missionUuid;
        }

        const fileUuids = includedFiles.value.map((file) => file.uuid);
        const renames = Object.fromEntries(
            includedFiles.value
                .filter((file) => resolutionOf(file).action === 'rename')
                .map((file) => [file.uuid, finalName(file)]),
        );
        await (mode.value === 'move'
            ? moveFiles(fileUuids, missionUuid, renames)
            : copyFiles(fileUuids, missionUuid, renames));
    },
    onSuccess: async () => {
        const count = includedFiles.value.length;
        Notify.create({
            group: false,
            message: `${mode.value === 'move' ? 'Moved' : 'Copied'} ${String(count)} ${count === 1 ? 'file' : 'files'}`,
            color: 'positive',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'files' ||
                query.queryKey[0] === 'missions',
        });
        onDialogOK();
    },
    onError(error: unknown) {
        const message =
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            (error as { response?: { data?: { message?: string } } })?.response
                ?.data?.message ?? 'Unknown error occurred';
        Notify.create({
            group: false,
            message: `Error: ${message}`,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 10_000,
        });
    },
});

const submit = (): void => {
    submitMutation();
};
</script>

<style scoped>
.transfer-dialog {
    max-width: 640px;
    gap: 16px;
}

.new-mission {
    border: 1px solid #0f62fe;
    border-radius: 4px;
    background: #f3f7ff;
}

.new-mission__tag {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: #0f62fe;
    background: #dfe9ff;
    border-radius: 3px;
    padding: 1px 6px;
}

.file-row__name {
    font-family: monospace;
    font-size: 13px;
    min-width: 0;
}

.file-row--conflict {
    background: #fff8e5;
}

.file-row__rename {
    max-width: 260px;
}

.text-warning-dark {
    color: #9a6700;
}

.cli-hint {
    background: #f6f8fa;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
}

.cli-hint__code {
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
