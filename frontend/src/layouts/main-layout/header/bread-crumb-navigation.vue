<template>
    <div class="bg-default text-grey-8" style="margin: 0 -24px; z-index: 999">
        <q-separator />

        <div
            class="height-xl flex column justify-center q-px-lg"
            style="overflow-x: auto"
        >
            <q-breadcrumbs
                gutter="xs"
                class="flex-nowrap"
                active-color="primary"
            >
                <template v-for="crumb in displayCrumbs" :key="crumb?.name">
                    <template v-if="crumb">
                        <q-breadcrumbs-el
                            v-if="isClickable(crumb)"
                            class="breadcrumb-link text-link-primary ellipsis rounded-borders q-px-sm transition-fast"
                            :to="crumb.to"
                            :label="crumb.displayName"
                        >
                            <q-skeleton
                                v-if="crumb.displayName === ''"
                                class="q-mr-md q-mb-sm"
                                style="
                                    width: 160px;
                                    height: 18px;
                                    margin-top: 5px;
                                "
                            />
                            <q-tooltip
                                v-if="crumb.displayName.length > 20"
                                anchor="bottom middle"
                                self="top middle"
                                :offset="[10, 10]"
                            >
                                {{ crumb.displayName }}
                            </q-tooltip>
                        </q-breadcrumbs-el>

                        <q-breadcrumbs-el
                            v-else
                            class="ellipsis q-px-sm"
                            :label="crumb.displayName"
                        >
                            <q-skeleton
                                v-if="crumb.displayName === ''"
                                class="q-mr-md q-mb-sm"
                                style="
                                    width: 160px;
                                    height: 18px;
                                    margin-top: 5px;
                                "
                            />
                            <q-tooltip
                                v-if="crumb.displayName.length > 20"
                                anchor="bottom middle"
                                self="top middle"
                                :offset="[10, 10]"
                            >
                                {{ crumb.displayName }}
                            </q-tooltip>
                        </q-breadcrumbs-el>
                    </template>
                </template>
            </q-breadcrumbs>
        </div>
        <q-separator v-if="resolvedCrumbs?.length >= 1" />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { useCrumbs } from 'src/hooks/crumbs';
import { useFile, useMission, useProjectQuery } from 'src/hooks/query-hooks';
import {
    useFileUUID,
    useMissionUUID,
    useProjectUUID,
} from 'src/hooks/router-hooks';
import { PageBreadCrumb } from 'src/router/routes-utilities';
import { computed } from 'vue';

const $q = useQuasar();
const crumbs = useCrumbs();

const projectUuid = useProjectUUID();
const missionUuid = useMissionUUID();
const fileUuid = useFileUUID();

const { data: project } = useProjectQuery(projectUuid);
const { data: mission } = useMission(missionUuid);
const { data: file } = useFile(fileUuid);

const resolvedCrumbs = computed(() => {
    let _crumbs = crumbs.value.map((crumb: PageBreadCrumb) => {
        return {
            to: crumb.to
                ?.replace(':projectUuid', projectUuid.value ?? 'undefined')
                .replace(':missionUuid', missionUuid.value ?? 'undefined')
                .replace(':file_uuid', fileUuid.value ?? ''),
            displayName: crumb.displayName
                .replace(':project_name', project.value?.name ?? '')
                .replace(':mission_name', mission.value?.name ?? '')
                .replace(':file_name', file.value?.filename ?? ''),
            name: crumb.name,
        } as PageBreadCrumb;
    });

    // remove crumbs with undefined values in to
    const firstUndefinedIndex = _crumbs.findIndex((crumb: PageBreadCrumb) =>
        crumb.to?.includes('undefined'),
    );
    _crumbs =
        firstUndefinedIndex === -1
            ? _crumbs
            : _crumbs.slice(0, firstUndefinedIndex);

    // remove link of crumb if it is the only crumb
    if (_crumbs !== undefined && _crumbs.length === 1) {
        // @ts-ignore
        _crumbs[0].to = undefined;
    }

    return _crumbs;
});

const displayCrumbs = computed(() => {
    const _crumbs = resolvedCrumbs.value;

    if ($q.screen.gt.sm) {
        return _crumbs;
    }

    if (_crumbs.length >= 2) {
        return [_crumbs.at(-2)];
    }

    return [];
});

const isClickable = (crumb: PageBreadCrumb): boolean => {
    return crumb.to !== undefined;
};
</script>

<style lang="scss" scoped>
.breadcrumb-link {
    transition: background-color 0.2s ease;

    &:hover {
        background-color: #e3f2fd;
    }
}
</style>
