import { Ref, unref } from 'vue';
import { ProjectAccessDto } from '@api/types/access-control/project-access.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { isAxiosError } from 'axios';
import { Notify } from 'quasar';
import { updateProjectAccessRights } from '../services/mutations/access';

export const useUpdateAccessRightsMutation = (
    projectUuid: string,
    newProjectAccessRights: Ref<ProjectAccessDto[]>,
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const accessRights = unref(newProjectAccessRights);
            if (!accessRights) throw new Error('Access rights not found');
            return updateProjectAccessRights(projectUuid, accessRights);
        },

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                predicate: (query) => query.queryKey[0] === 'projectAccess',
            });
            await queryClient.invalidateQueries({
                predicate: (query) => query.queryKey[0] === 'AccessGroup',
            });
        },
        onError: (error: unknown) => {
            let errorMessage = 'An unknown error occurred';

            if (isAxiosError(error)) {
                errorMessage =
                    error.response?.data?.message ??
                    'No error message provided';
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            Notify.create({
                message: `Failed to change access rights:  ${errorMessage}`,
                color: 'negative',
                position: 'bottom',
            });
        },
    });
};
