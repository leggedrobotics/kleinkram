import type { ProjectAccessDto } from '@kleinkram/api-dto/types/access-control/project-access.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { updateProjectAccessRights } from 'src/services/mutations/access';
import { Ref, unref } from 'vue';

export const useUpdateAccessRightsMutation = (
    projectUuid: string,
    newProjectAccessRights: Ref<ProjectAccessDto[]>,
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const accessRights = unref(newProjectAccessRights);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
            // the project (and project lists) carry `isPublic`, shown as the
            // Public chip on the project page
            await queryClient.invalidateQueries({
                predicate: (query) =>
                    query.queryKey[0] === 'projects' ||
                    query.queryKey[0] === 'project',
            });
        },
    });
};
