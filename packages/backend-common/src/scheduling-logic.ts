import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { WorkerEntity } from '@backend-common/entities/worker/worker.entity';
import { RuntimeDescription } from '@backend-common/types';
import { ActionState } from '@kleinkram/shared';
import { MoreThanOrEqual, Repository } from 'typeorm';

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
        action.state = ActionState.UNPROCESSABLE;
        action.state_cause =
            'No worker available with the required hardware capabilities';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await actionRepository.save(action);
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
