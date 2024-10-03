import { RuntimeRequirements } from './types';
import Action from './entities/action/action.entity';
import Worker from './entities/worker/worker.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ActionState } from './enum';

export async function findWorkerForAction(
    runtime_requirements: RuntimeRequirements,
    workerRepository: Repository<Worker>,
    actionQueues: Record<string, any>,
    logger: any,
) {
    const needsGPU = runtime_requirements.gpu_model.name !== 'no-gpu';
    const defaultWhere = {
        reachable: true,
        hasGPU: needsGPU,
        cpuMemory: MoreThanOrEqual(runtime_requirements.memory + 1), // +1 as OS requires at least 1GB
    };
    let worker = await workerRepository.find({
        where: defaultWhere,
        order: {
            hostname: 'DESC',
        },
    });
    logger.debug(
        `Available Worker (GPU: ${needsGPU}): ${worker.map((a) => a.identifier).join(', ')}`,
    );

    if (worker.length === 0 && !needsGPU) {
        defaultWhere.hasGPU = true;
        worker = await workerRepository.find({
            where: defaultWhere,
        });
        logger.debug(
            `Alternative Worker (GPU: any): ${worker.map((a) => a.identifier).join(', ')}`,
        );
    }

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
    runtime_requirements: RuntimeRequirements,
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
