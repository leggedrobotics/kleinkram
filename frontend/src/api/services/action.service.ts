import type { ActionLogsDto } from '@kleinkram/api-dto/types/actions/action-logs.dto';
import type { ActionTemplateAvailabilityDto } from '@kleinkram/api-dto/types/actions/action-template-availability.dto';
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import type { ActionTemplatesDto } from '@kleinkram/api-dto/types/actions/action-templates.dto';
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import type { ActionsDto } from '@kleinkram/api-dto/types/actions/actions.dto';
import type { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
import type { UpdateTemplateDto } from '@kleinkram/api-dto/types/actions/update-template.dto';
import type { FileEventsDto } from '@kleinkram/api-dto/types/file/file-event.dto';
import type {
    ActionSubmitResponseDto,
    SubmitActionDto,
} from '@kleinkram/api-dto/types/submit-action-response.dto';
import type {
    ActionQuery,
    SubmitActionMulti,
} from '@kleinkram/api-dto/types/submit-action.dto';
import axios from 'src/api/axios';

export const ActionService = {
    /**
     * Trigger a single action execution
     */
    async createAnalysis(
        payload: SubmitActionDto,
    ): Promise<ActionSubmitResponseDto> {
        const { data } = await axios.post<ActionSubmitResponseDto>(
            '/actions',
            payload,
        );
        return data;
    },

    /**
     * Trigger multiple action executions (Batch)
     */
    async createMultipleAnalysis(
        payload: SubmitActionMulti,
    ): Promise<ActionSubmitResponseDto[]> {
        const { data } = await axios.post<ActionSubmitResponseDto[]>(
            '/actions/batch',
            payload,
        );
        return data;
    },

    async getAll(queryParameters: ActionQuery): Promise<ActionsDto> {
        const { data } = await axios.get<ActionsDto>('/actions', {
            params: queryParameters,
        });
        return data;
    },

    async getOne(uuid: string): Promise<ActionDto> {
        const { data } = await axios.get<ActionDto>(`/actions/${uuid}`);
        return data;
    },

    async delete(uuid: string): Promise<void> {
        await axios.delete(`/actions/${uuid}`);
    },

    async createTemplate(
        payload: CreateTemplateDto,
    ): Promise<ActionTemplateDto> {
        const { data } = await axios.post<ActionTemplateDto>(
            '/templates',
            payload,
        );
        return data;
    },

    async createTemplateVersion(
        payload: UpdateTemplateDto,
    ): Promise<ActionTemplateDto> {
        const { data } = await axios.post<ActionTemplateDto>(
            `/templates/${payload.uuid}/versions`,
            payload,
        );
        return data;
    },

    async listTemplates(
        search?: string,
        includeArchived = false,
        skip = 0,
        take = 20,
    ): Promise<ActionTemplatesDto> {
        const { data } = await axios.get<ActionTemplatesDto>('/templates', {
            params: { search, includeArchived, skip, take },
        });
        return data;
    },

    async getTemplateRevisions(
        uuid: string,
        skip = 0,
        take = 20,
    ): Promise<ActionTemplatesDto> {
        const { data } = await axios.get<ActionTemplatesDto>(
            `/templates/${uuid}/revisions`,
            {
                params: { skip, take },
            },
        );
        return data;
    },

    async getTemplate(uuid: string): Promise<ActionTemplateDto> {
        const { data } = await axios.get<ActionTemplatesDto>(
            `/templates/${uuid}/revisions`,
            {
                params: { skip: 0, take: 1 },
            },
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const latest = data.data?.[0];
        if (!latest) {
            throw new Error(`Template with uuid ${uuid} not found`);
        }
        return latest;
    },

    async checkNameAvailability(name: string): Promise<boolean> {
        const { data } = await axios.get<ActionTemplateAvailabilityDto>(
            '/templates/availability',
            { params: { name } },
        );
        return data.available;
    },

    async deleteTemplate(uuid: string): Promise<void> {
        await axios.delete(`/templates/${uuid}`);
    },

    async getLogs(uuid: string, skip = 0, take = 100): Promise<ActionLogsDto> {
        const { data } = await axios.get<ActionLogsDto>(
            `/actions/${uuid}/logs`,
            {
                params: { skip, take },
            },
        );
        return data;
    },

    async getActionFileEvents(uuid: string): Promise<FileEventsDto> {
        const { data } = await axios.get<FileEventsDto>(
            `/actions/${uuid}/file-events`,
        );
        return data;
    },
};
