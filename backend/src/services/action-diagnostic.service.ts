import {
    ActionDiagnosticDto,
    ActionDiagnosticsDto,
    CreateActionDiagnosticDto,
} from '@kleinkram/api-dto';
import { ActionDiagnosticEntity } from '@kleinkram/backend-common/entities/action/action-diagnostic.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import {
    ACTION_DIAGNOSTIC_LIMIT,
    ActionSeverity,
    actionSeverityFromDiagnostic,
    isTerminalActionState,
    severitiesBelow,
} from '@kleinkram/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

const diagnosticEntityToDto = (
    diagnostic: ActionDiagnosticEntity,
): ActionDiagnosticDto => ({
    uuid: diagnostic.uuid,
    severity: diagnostic.severity,
    message: diagnostic.message,
    code: diagnostic.code,
    file: diagnostic.file,
    count: diagnostic.count,
    details: diagnostic.details,
    createdAt: diagnostic.createdAt,
});

@Injectable()
export class ActionDiagnosticService {
    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(ActionDiagnosticEntity)
        private diagnosticRepository: Repository<ActionDiagnosticEntity>,
    ) {}

    /**
     * Records one diagnostic reported by a running action container and raises
     * the action's severity to match.
     *
     * Identical reports are folded into a single row with a count. Both writes
     * to the action itself are expressed as conditional SQL rather than a
     * read-modify-write: a container is free to report from several processes
     * at once, and a lost update there would silently undercount findings or
     * talk an ERROR verdict back down to WARNING.
     *
     * @param actionUuid the action the container is running for
     * @param dto the finding the container reported
     */
    async record(
        actionUuid: string,
        dto: CreateActionDiagnosticDto,
    ): Promise<void> {
        await this.actionRepository.manager.transaction(async (manager) => {
            const actionRepository = manager.getRepository(ActionEntity);
            const diagnosticRepository = manager.getRepository(
                ActionDiagnosticEntity,
            );

            const action = await actionRepository.findOne({
                where: { uuid: actionUuid },
                lock: { mode: 'pessimistic_write' },
            });

            if (!action) {
                throw new BadRequestException('Action not found');
            }

            if (isTerminalActionState(action.state)) {
                throw new BadRequestException(
                    'Action has already finished; it can no longer report diagnostics.',
                );
            }

            const existing = await diagnosticRepository.findOne({
                where: {
                    actionUuid,
                    severity: dto.severity,
                    message: dto.message,
                    code: dto.code ?? IsNull(),
                    file: dto.file ?? IsNull(),
                },
            });

            if (existing) {
                await diagnosticRepository.update(
                    { uuid: existing.uuid },
                    { count: existing.count + 1 },
                );
            } else if (action.diagnosticCount >= ACTION_DIAGNOSTIC_LIMIT) {
                // Past the cap we keep raising the severity but stop storing
                // rows, so the action still reads as warned without the list
                // growing without bound.
                await actionRepository.update(
                    { uuid: actionUuid },
                    { diagnosticsTruncated: true },
                );
            } else {
                await diagnosticRepository.save(
                    diagnosticRepository.create({
                        actionUuid,
                        severity: dto.severity,
                        message: dto.message,
                        code: dto.code,
                        file: dto.file,
                        details: dto.details,
                        count: 1,
                    }),
                );
                // SET "diagnosticCount" = "diagnosticCount" + 1, so two
                // concurrent reports cannot read the same value and both
                // write it back.
                await actionRepository.increment(
                    { uuid: actionUuid },
                    'diagnosticCount',
                    1,
                );
            }

            const severity = actionSeverityFromDiagnostic(dto.severity);
            const overwritable = severitiesBelow(severity);

            if (overwritable.length > 0 && severity !== ActionSeverity.OK) {
                // Only ever raises: the WHERE clause refuses to overwrite a
                // verdict that is already at least this severe.
                await actionRepository
                    .createQueryBuilder()
                    .update(ActionEntity)
                    .set({ severity })
                    .where('uuid = :uuid', { uuid: actionUuid })
                    .andWhere('severity IN (:...overwritable)', {
                        overwritable,
                    })
                    .execute();
            }
        });
    }

    /**
     * @param actionUuid the action to read diagnostics for
     * @returns every diagnostic the action reported, most severe first
     */
    async findAll(actionUuid: string): Promise<ActionDiagnosticsDto> {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: actionUuid },
            select: { uuid: true, diagnosticsTruncated: true },
        });

        const diagnostics = await this.diagnosticRepository.find({
            where: { actionUuid },
            order: { createdAt: 'ASC' },
        });

        return {
            data: diagnostics.map((diagnostic) =>
                diagnosticEntityToDto(diagnostic),
            ),
            count: diagnostics.reduce(
                (total, diagnostic) => total + diagnostic.count,
                0,
            ),
            truncated: action.diagnosticsTruncated,
        };
    }
}
