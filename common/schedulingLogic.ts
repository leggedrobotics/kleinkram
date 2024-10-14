import { RuntimeDescription } from './types';
import Action from './entities/action/action.entity';
import Worker from './entities/worker/worker.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ActionState } from './enum';

export async function findWorkerForAction(
    runtime_requirements: RuntimeDescription,
    workerRepository: Repository<Worker>,
    actionQueues: Record<string, any>,
    logger: any,
) {
    const defaultWhere = {
        reachable: true,
        cpuMemory: MoreThanOrEqual(runtime_requirements.cpuMemory + 1), // +1 as OS requires at least 1GB
        cpuCores: MoreThanOrEqual(runtime_requirements.cpuCores),
        gpuMemory: MoreThanOrEqual(runtime_requirements.gpuMemory),
    };
    const worker = await workerRepository.find({
        where: defaultWhere,
        order: {
            hostname: 'DESC',
        },
    });
    logger.debug(
        `Available Worker (GPU: ${runtime_requirements.gpuMemory}GB): ${worker.map((a) => a.identifier).join(', ')}`,
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
    const res = worker.sort(
        (a, b) => nrJobs[a.identifier] - nrJobs[b.identifier],
    )[0];
    // return worker[Math.floor(Math.random() * worker.length)];
    return res;
}
export async function addActionQueue(
    action: Action,
    runtime_requirements: RuntimeDescription,
    workerRepository: any,
    actionRepository: any,
    actionQueues: Record<string, any>,
    logger: any = undefined,
) {
    const worker = await findWorkerForAction(
        runtime_requirements,
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
                    delay: 60 * 1_000, // 60 seconds
                    type: 'exponential',
                },
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 60, // one hour of attempts
            },
        );
    } catch (e) {
        console.error(e);
    }
}
