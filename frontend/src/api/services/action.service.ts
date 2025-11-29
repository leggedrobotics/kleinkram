import { ActionLogsDto } from '@api/types/actions/action-logs.dto';
import { ActionTemplateAvailabilityDto } from '@api/types/actions/action-template-availability.dto';
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import { ActionTemplatesDto } from '@api/types/actions/action-templates.dto';
import { ActionDto } from '@api/types/actions/action.dto';
import { ActionsDto } from '@api/types/actions/actions.dto';
import { CreateTemplateDto } from '@api/types/actions/create-template.dto';
import { UpdateTemplateDto } from '@api/types/actions/update-template.dto';
import { FileEventsDto } from '@api/types/file/file-event.dto';
import {
    ActionSubmitResponseDto,
    SubmitActionDto,
} from '@api/types/submit-action-response.dto';
import { ActionQuery, SubmitActionMulti } from '@api/types/submit-action.dto';
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
