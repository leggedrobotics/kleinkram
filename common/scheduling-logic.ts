import { RuntimeDescription } from './types';
import Action from './entities/action/action.entity';
import Worker from './entities/worker/worker.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ActionState } from './frontend_shared/enum';

export async function findWorkerForAction(
    runtimeRequirements: RuntimeDescription,
    workerRepository: Repository<Worker>,
    actionQueues: Record<string, any>,
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
    logger.debug(
        `Available Worker (GPU: ${runtimeRequirements.gpuMemory.toString()}GB): ${worker.map((a) => a.identifier).join(', ')}`,
    );

    if (worker.length === 0) {
        return;
    }

    const nrJobs = {};
    await Promise.all(
        Object.entries(actionQueues).map(async ([name, queue]) => {
            nrJobs[name] = await queue.count();
        }),
    );
    logger.debug('jobDistribution: ', nrJobs);
    return worker.sort(
        (a, b) => nrJobs[a.identifier] - nrJobs[b.identifier],
    )[0];
}

export async function addActionQueue(
    action: Action,
    runtimeRequirements: RuntimeDescription,
    workerRepository: any,
    actionRepository: any,
    actionQueues: Record<string, any>,
    logger?: any,
) {
    const worker = await findWorkerForAction(
        runtimeRequirements,
        workerRepository,
        actionQueues,
        logger,
    );
    if (!worker) {
        action.state = ActionState.UNPROCESSABLE;
        action.state_cause =
            'No worker available with the required hardware capabilities';
        await actionRepository.save(action);
        return;
    }
    logger.debug(`Selected worker: ${worker.identifier}`);

    logger.debug('Worker found');
    await actionRepository
        .createQueryBuilder()
        .update()
        .set({ worker })
        .where('uuid = :uuid', { uuid: action.uuid })
        .execute();

    try {
        logger.debug(
            `trying to add to queue: ${actionQueues[worker.identifier].name}`,
        );
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
