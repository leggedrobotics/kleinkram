import { userEntityToDto } from '@/serialization';
import { ActionStateHistoryDto } from '@kleinkram/api-dto';
import { ActionStateTransitionEntity } from '@kleinkram/backend-common/entities/action/action-state-transition.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { describeStateCause } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ActionStateHistoryService {
    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(ActionStateTransitionEntity)
        private transitionRepository: Repository<ActionStateTransitionEntity>,
    ) {}

    /**
     * Every state an action went through, oldest first, each with its cause
     * described using the current names of the users and mission involved.
     */
    async findAll(actionUuid: string): Promise<ActionStateHistoryDto> {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: actionUuid },
            relations: { creator: true, mission: true },
        });
        const transitions = await this.transitionRepository.find({
            where: { actionUuid },
            relations: { actor: true },
            order: { createdAt: 'ASC' },
        });

        return {
            data: transitions.map((transition) => ({
                uuid: transition.uuid,
                state: transition.state,
                causeCode: transition.causeCode ?? null,
                cause:
                    describeStateCause(
                        {
                            code: transition.causeCode,
                            params: transition.causeParams,
                            message: transition.message,
                        },
                        {
                            creatorName: action.creator?.name,
                            missionName: action.mission?.name,
                            actorName: transition.actor?.name,
                        },
                    ) ??
                    transition.causeCode ??
                    '',
                actor: transition.actor
                    ? userEntityToDto(transition.actor)
                    : null,
                createdAt: transition.createdAt,
            })),
        };
    }
}
