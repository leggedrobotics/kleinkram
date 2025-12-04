import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import type { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
import type { UpdateTemplateDto } from '@kleinkram/api-dto/types/actions/update-template.dto';
import type { ActionSubmitResponseDto } from '@kleinkram/api-dto/types/submit-action-response.dto';
import {
    useMutation,
    UseMutationReturnType,
    useQueryClient,
} from '@tanstack/vue-query';
import { actionKeys } from 'src/api/keys/action-keys';
import { ActionService } from 'src/api/services/action.service';

export function useCreateTemplate(): UseMutationReturnType<
    ActionTemplateDto,
    Error,
    CreateTemplateDto,
    unknown
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: CreateTemplateDto) =>
            ActionService.createTemplate(dto),
        onSuccess: () => {
            return queryClient.invalidateQueries({
                queryKey: actionKeys.templates.all,
            });
        },
    });
}

export function useUpdateTemplateVersion(): UseMutationReturnType<
    ActionTemplateDto,
    Error,
    UpdateTemplateDto,
    unknown
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: UpdateTemplateDto) =>
            ActionService.createTemplateVersion(dto),
        onSuccess: async (data) => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: actionKeys.templates.all,
                }),
                queryClient.invalidateQueries({
                    queryKey: actionKeys.templates.revisions(data.uuid),
                }),
            ]);
        },
    });
}

export function useDeleteAction(): UseMutationReturnType<
    void,
    Error,
    string,
    unknown
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (uuid: string) => ActionService.delete(uuid),
        onSuccess: () => {
            return queryClient.invalidateQueries({ queryKey: actionKeys.all });
        },
    });
}

export function useDeleteTemplate(): UseMutationReturnType<
    void,
    Error,
    string,
    unknown
> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => ActionService.deleteTemplate(uuid),
        onSuccess: () => {
            return queryClient.invalidateQueries({
                queryKey: actionKeys.templates.all,
            });
        },
    });
}

export interface SubmitActionPayload {
    missionUUID?: string | undefined;
    missionUUIDs?: string[] | undefined;
    templateUUID: string;
}

export function useSubmitAction(): UseMutationReturnType<
    ActionSubmitResponseDto[] | ActionSubmitResponseDto,
    Error,
    SubmitActionPayload,
    unknown
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: SubmitActionPayload) => {
            if (payload.missionUUIDs && payload.missionUUIDs.length > 0) {
                return ActionService.createMultipleAnalysis({
                    missionUUIDs: payload.missionUUIDs,
                    templateUUID: payload.templateUUID,
                });
            } else if (payload.missionUUID) {
                return ActionService.createAnalysis({
                    missionUUID: payload.missionUUID,
                    templateUUID: payload.templateUUID,
                });
            }
            throw new Error('No mission selected for execution');
        },
        onSuccess: () => {
            return queryClient.invalidateQueries({
                queryKey: actionKeys.running(),
            });
        },
    });
}
