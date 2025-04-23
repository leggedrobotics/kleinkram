<template>
    <div style="margin: 10px" class="row flex items-center justify-between">
        <q-select
            ref="userSelect"
            v-model="selected"
            use-input
            multiple
            input-debounce="100"
            :options="foundUsers?.users ?? []"
            option-label="name"
            class="full-width"
            @input-value="onInputUpdate"
        >
            <template #no-option>
                <q-item>
                    <q-item-section class="text-grey">
                        No results
                    </q-item-section>
                </q-item>
            </template>
            <template #selected-item="scope">
                <q-chip
                    removable
                    :tabindex="scope.tabindex"
                    :icon="icon(scope.opt.type)"
                    @remove="() => scope.removeAtIndex(scope.index)"
                >
                    {{ scope.opt.name }}
                </q-chip>
            </template>
            <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps">
                    <q-item-section>
                        <q-item-label>
                            <div class="row" style="height: 20px">
                                <p
                                    style="
                                        width: 30%;
                                        min-width: 60px;
                                        max-width: 300px;
                                    "
                                >
                                    {{ opt.name }}
                                </p>
                                <p>{{ opt.email }}</p>
                            </div>
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </template>
        </q-select>
    </div>
</template>
<script setup lang="ts">
import { UserDto } from '@api/types/user.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { useUserSearch } from 'src/hooks/query-hooks';
import { icon } from 'src/services/generic';
import { addUserToAccessGroup } from 'src/services/mutations/access';
import { Ref, ref } from 'vue';

const properties = defineProps<{
    accessGroupUuid: string;
}>();
const queryClient = useQueryClient();

const userSelect = ref();
const search = ref('');
const selected: Ref<UserDto[]> = ref([]);
const { data: foundUsers } = useUserSearch(search);

const { mutate } = useMutation({
    mutationFn: () => {
        return Promise.all(
            selected.value.map(async (user) => {
                return addUserToAccessGroup(
                    user.uuid,
                    properties.accessGroupUuid,
                );
            }),
        );
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Users added to access group',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', properties.accessGroupUuid],
        });
    },
    onError: () => {
        Notify.create({
            message: 'Failed to add some users to access group',
            color: 'negative',
            position: 'bottom',
        });
    },
});

const onInputUpdate = (value: string) => {
    search.value = value;
    if (value.length > 0) {
        userSelect.value?.showPopup(); // Ensure dropdown opens again
    }
};

defineExpose({ mutate });
</script>

<style scoped></style>
