<template>
    <div class="bg-default text-grey-8" style="margin: 0 -24px; z-index: 999">
        <q-separator />

        <div class="height-xl flex column justify-center q-px-lg">
            <q-breadcrumbs gutter="md">
                <template v-for="crumb in resolvedCrumbs" :key="crumb.name">
                    <q-breadcrumbs-el
                        v-if="isClickable(crumb)"
                        class="text-link-primary"
                        :to="crumb.to"
                        :label="crumb.displayName"
                    >
                        <q-skeleton
                            v-if="crumb.displayName === ''"
                            class="q-mr-md q-mb-sm"
                            style="width: 160px; height: 18px; margin-top: 5px"
                        />
                    </q-breadcrumbs-el>

                    <q-breadcrumbs-el v-else :label="crumb.displayName">
                        <q-skeleton
                            v-if="crumb.displayName === ''"
                            class="q-mr-md q-mb-sm"
                            style="width: 160px; height: 18px; margin-top: 5px"
                        />
                    </q-breadcrumbs-el>
                </template>
            </q-breadcrumbs>
        </div>
        <q-separator v-if="resolvedCrumbs?.length >= 1" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useCrumbs } from 'src/hooks/crumbs';
import { PageBreadCrumb } from 'src/router/routesUtils';
import { useFileUUID, useMissionUUID, useProjectUUID } from 'src/hooks/utils';
import {
    useFile,
    useMission,
    useProjectQuery,
} from '../hooks/customQueryHooks';

const crumbs = useCrumbs();

const projectUuid = useProjectUUID();
const missionUuid = useMissionUUID();
const fileUuid = useFileUUID();

const { data: project } = useProjectQuery(projectUuid);
const { data: mission } = useMission(missionUuid);
const { data: file } = useFile(fileUuid.value);

const resolvedCrumbs = computed(() => {
    let _crumbs = crumbs.value.map((crumb: PageBreadCrumb) => {
        return {
            to: crumb.to
                ?.replace(':project_uuid', projectUuid.value ?? '')
                .replace(':mission_uuid', missionUuid.value ?? '')
                .replace(':file_uuid', fileUuid.value ?? ''),
            displayName: crumb.displayName
                .replace(':project_name', project.value?.name ?? '')
                .replace(':mission_name', mission.value?.name ?? '')
                .replace(':file_name', file.value?.filename ?? ''),
            name: crumb.name,
        };
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
    if (_crumbs.length === 1) {
        _crumbs[0].to = undefined;
    }

    return _crumbs;
});

const isClickable = (crumb: PageBreadCrumb): boolean => {
    const index = crumbs.value.findIndex(
        (c: PageBreadCrumb) => c.displayName === crumb.displayName,
    );
    return index !== crumbs.value.length - 1;
};
</script>
