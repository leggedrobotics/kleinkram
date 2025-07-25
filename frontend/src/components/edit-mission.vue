<template>
    <div class="row">
        <div class="col-11">
            <q-chip
                v-for="tag in data?.tags.toSorted((a: TagDto, b: TagDto) =>
                    a.type.name.localeCompare(b.type.name),
                )"
                :key="tag.uuid"
                :icon-right="
                    // @ts-ignore
                    icons[tag.datatype as DataType] as string
                "
                class="rotating-element"
                removable
                @remove="() => removeTagCallback(tag)"
            >
                <b>{{ tag.type.name }}:&nbsp;</b>{{ tag.name }}
            </q-chip>
        </div>
        <div class="col-1 q-pa-md">
            <q-btn color="primary" icon="sym_o_add" @click="openAddTag">
                Add Metadata
            </q-btn>
        </div>
    </div>
</template>
<script setup lang="ts">
import { TagDto } from '@api/types/tags/tags.dto';
import { DataType } from '@common/enum';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useQuasar } from 'quasar';
import AddTagDialog from 'src/dialogs/add-tag-dialog.vue';
import { useMission } from 'src/hooks/query-hooks';
import { removeTag } from 'src/services/mutations/tag';

const queryClient = useQueryClient();
const $q = useQuasar();

const properties = defineProps<{
    missionUuid: string;
}>();

const icons = {
    [DataType.STRING]: 'sym_o_description',
    [DataType.NUMBER]: 'sym_o_123',
    [DataType.BOOLEAN]: 'sym_o_check',
    [DataType.DATE]: 'sym_o_event',
    [DataType.LOCATION]: 'sym_o_place',
};

const { data } = useMission(properties.missionUuid);

await new Promise((resolve) => setTimeout(resolve, 20)).then(() => {
    // @ts-ignore
    for (const element of document.querySelectorAll('.rotating-element')) {
        const randomDuration = Math.random() * 10_000 + 200; // Random duration between 1s and 5s
        // @ts-ignore
        element.style['-webkit-animation-duration'] =
            `${randomDuration.toString()}s`;
        if (Math.random() > 0.5) {
            // @ts-ignore
            element.style['-webkit-animation-direction'] = `reverse`;
        }
    }
});
const { mutate: removeTagCallback } = useMutation({
    mutationFn: (tag: TagDto) => removeTag(tag.uuid),
    async onSuccess() {
        Notify.create({
            message: 'Tag removed',
            color: 'positive',
            position: 'bottom',
        });
        const cache = queryClient.getQueryCache();
        const filtered = cache
            .getAll()
            .filter(
                (query) =>
                    query.queryKey[0] === 'mission' &&
                    query.queryKey[1] === properties.missionUuid,
            );
        for (const query of filtered) {
            await queryClient.invalidateQueries({
                queryKey: query.queryKey,
            });
        }
    },
    onError(error: unknown) {
        console.log(error);
    },
});

function openAddTag() {
    $q.dialog({
        component: AddTagDialog,
        componentProps: {
            missionUuid: properties.missionUuid,
        },
        persistent: true,
    });
}
</script>

<style scoped>
@keyframes rotate {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

.rotating-element {
    animation: rotate 20000s linear infinite;
    z-index: 99;
}
</style>
