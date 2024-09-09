<template>
    <div class="bg-default text-grey-8" style="margin: 0 -24px; z-index: 999">
        <q-separator />

        <div class="height-xl flex column justify-center q-px-lg">
            <q-breadcrumbs gutter="md">
                <template v-for="crumb in resolved_crumbs" :key="crumb.name">
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
        <q-separator v-if="resolved_crumbs?.length >= 1" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useCrumbs } from 'src/hooks/crumbs';
import { PageBreadCrumb } from 'src/router/routesUtils';
import { useFileUUID, useMissionUUID, useProjectUUID } from 'src/hooks/utils';
import { useQuery } from '@tanstack/vue-query';
import { getProject } from 'src/services/queries/project';
import { getMission } from 'src/services/queries/mission';
import { fetchFile } from 'src/services/queries/file';

const crumbs = useCrumbs();

const project_uuid = useProjectUUID();
const mission_uuid = useMissionUUID();
const file_uuid = useFileUUID();

const { data: project } = useQuery({
    queryKey: ['project', project_uuid],
    queryFn: async () => {
        if (!project_uuid.value) return;
        return getProject(project_uuid.value);
    },
    enabled: !!project_uuid.value,
});

const { data: mission } = useQuery({
    queryKey: ['mission', mission_uuid],
    queryFn: async () => {
        if (!mission_uuid.value) return;
        return getMission(mission_uuid.value);
    },
    enabled: !!mission_uuid.value,
});

const { data: file } = useQuery({
    queryKey: ['file', file_uuid],
    queryFn: async () => {
        if (!file_uuid.value) return;
        return fetchFile(file_uuid.value);
    },
    enabled: !!file_uuid.value,
});

const resolved_crumbs = computed(() =>
    crumbs.value?.map((crumb: PageBreadCrumb) => {
        return {
            to: crumb.to
                ?.replace(':project_uuid', project_uuid.value)
                ?.replace(':mission_uuid', mission_uuid.value)
                ?.replace(':file_uuid', file_uuid.value),
            displayName: crumb.displayName
                .replace(':project_name', project.value?.name || '')
                .replace(':mission_name', mission.value?.name || '')
                .replace(':file_name', file.value?.filename || ''),
        };
    }),
);

const isClickable = (crumb: PageBreadCrumb) => {
    const idx = crumbs.value?.findIndex(
        (c: PageBreadCrumb) => c.displayName === crumb.displayName,
    );
    return idx !== crumbs.value.length - 1 && !!crumb.to;
};
</script>
