<template>
    <div class="row">
        <div class="col-11">
            <q-chip
                v-for="tag in data?.tags.toSorted((a, b) =>
                    a.type.name.localeCompare(b.type.name),
                )"
                :icon-right="icons[tag.type.type]"
                class="rotating-element"
                :key="tag.uuid"
                removable
                @remove="removeTagCallback(tag)"
            >
                <b>{{ tag.type.name }}:&nbsp;</b>{{ tag.asString() }}
            </q-chip>
        </div>
        <div class="col-1 q-pa-md">
            <q-btn color="primary" icon="add" @click="openAddTag">
                Add Tag
            </q-btn>
        </div>
    </div>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { DataType } from 'src/enum/TAG_TYPES';
import { getMission } from 'src/services/queries';
import { Mission, Tag } from 'src/types/types';
import { removeTag } from 'src/services/mutations';
import { Notify, useQuasar } from 'quasar';
import AddTagDialog from 'components/AddTagDialog.vue';
const queryClient = useQueryClient();
const $q = useQuasar();

const props = defineProps<{
    mission_uuid: string;
}>();

const icons = {
    [DataType.STRING]: 'description',
    [DataType.NUMBER]: '123',
    [DataType.BOOLEAN]: 'check',
    [DataType.DATE]: 'event',
    [DataType.LOCATION]: 'place',
};

const { data } = useQuery<Mission>({
    queryKey: ['mission', props.mission_uuid],
    queryFn: () => getMission(props.mission_uuid),
    enabled: !!props.mission_uuid,
});

new Promise((resolve) => setTimeout(resolve, 20)).then(() => {
    document.querySelectorAll('.rotating-element').forEach((el) => {
        const randomDuration = Math.random() * 10000 + 200; // Random duration between 1s and 5s
        el.style['-webkit-animation-duration'] = `${randomDuration}s`;
        if (Math.random() > 0.5) {
            el.style['-webkit-animation-direction'] = `reverse`;
        }
    });
});
const { mutate: removeTagCallback } = useMutation({
    mutationFn: (tag: Tag) => removeTag(tag.uuid),
    onSuccess(data, variables, context) {
        Notify.create({
            message: 'Tag removed',
            color: 'positive',
        });
        const cache = queryClient.getQueryCache();
        const filtered = cache
            .getAll()
            .filter(
                (query) =>
                    query.queryKey[0] === 'mission' &&
                    query.queryKey[1] === props.mission_uuid,
            );
        filtered.forEach((query) => {
            queryClient.invalidateQueries(query.queryKey);
        });
    },
    onError(error, variables, context) {
        console.log(error);
    },
});

function openAddTag() {
    $q.dialog({
        component: AddTagDialog,
        componentProps: {
            mission_uuid: props.mission_uuid,
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
