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
            @input-value="
                (val) => {
                    search = val;
                    if (val.length > 0) {
                        // @ts-ignore
                        $refs?.userSelect?.showPopup(); // Ensure dropdown opens again
                    }
                }
            "
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
import { Ref, ref } from 'vue';
import { icon } from 'src/services/generic';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { addUserToAccessGroup } from 'src/services/mutations/access';
import { Notify } from 'quasar';
import { useUserSearch } from '../hooks/query-hooks';
import { UserDto } from '@api/types/User.dto';

const properties = defineProps<{
    access_group_uuid: string;
}>();
const queryClient = useQueryClient();

const search = ref('');
const selected: Ref<UserDto[]> = ref([]);
const { data: foundUsers } = useUserSearch(search);

const { mutate } = useMutation({
    mutationFn: () => {
        return Promise.all(
            selected.value.map(async (user) => {
                return addUserToAccessGroup(
                    user.uuid,
                    properties.access_group_uuid,
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
            queryKey: ['AccessGroup', properties.access_group_uuid],
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

defineExpose({ mutate });
</script>

<style scoped></style>
