import {
    ActionSeverity,
    ActionState,
    ActionStateCause,
} from '@kleinkram/shared';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ActionEntity } from './entities/action/action.entity';
import { WorkerEntity } from './entities/worker/worker.entity';
import { transitionAction } from './services/action-state-transition';
import { RuntimeDescription } from './types';

export async function findWorkerForAction(
    runtimeRequirements: RuntimeDescription,
    workerRepository: Repository<WorkerEntity>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actionQueues: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: any,
) {
    const defaultWhere = {
        reachable: true,
        cpuMemory: MoreThanOrEqual(runtimeRequirements.cpuMemory + 1), // +1 as OS requires at least 1GB
        cpuCores: MoreThanOrEqual(runtimeRequirements.cpuCores),
        gpuMemory: MoreThanOrEqual(runtimeRequirements.gpuMemory),
    };
    const worker = await workerRepository.find({
        where: defaultWhere,
        order: {
            hostname: 'DESC',
        },
    });

    const activeWorkers = worker.filter((w) => actionQueues[w.identifier]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.debug(
        `Available Worker (GPU: ${runtimeRequirements.gpuMemory.toString()}GB): ${activeWorkers.map((a) => a.identifier).join(', ')}`,
    );

    if (activeWorkers.length === 0) {
        return;
    }

    const nrJobs: Record<string, number> = {};
    await Promise.all(
        Object.entries(actionQueues).map(async ([name, queue]) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            nrJobs[name] = await queue.count();
        }),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.debug('jobDistribution: ', nrJobs);
    //  eslint-disable-next-line unicorn/no-array-sort
    return activeWorkers.sort(
        (a, b) => nrJobs[a.identifier] - nrJobs[b.identifier],
    )[0];
}

export async function addActionQueue(
    action: ActionEntity,
    runtimeRequirements: RuntimeDescription,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workerRepository: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actionRepository: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actionQueues: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger?: any,
) {
    const worker = await findWorkerForAction(
        runtimeRequirements,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        workerRepository,
        actionQueues,
        logger,
    );
    if (!worker) {
        await transitionAction(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            actionRepository.manager,
            action.uuid,
            {
                state: ActionState.UNPROCESSABLE,
                cause: { code: ActionStateCause.NO_WORKER_AVAILABLE },
                set: { severity: ActionSeverity.ERROR },
            },
        );
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.debug(`Selected worker: ${worker.identifier}`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.debug('Worker found');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await actionRepository
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .createQueryBuilder()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .update()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .set({ worker })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .where('uuid = :uuid', { uuid: action.uuid })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .execute();

    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        logger.debug(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
            `trying to add to queue: ${actionQueues[worker.identifier].name}`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        return await actionQueues[worker.identifier].add(
            `action`,
            { uuid: action.uuid },
            {
                jobId: action.uuid,
                backoff: {
                    delay: 60 * 1000, // 60 seconds
                    type: 'exponential',
                },
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 60, // one hour of attempts
            },
        );
    } catch (error) {
        console.error(error);
    }
}
