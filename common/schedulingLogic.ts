import { RuntimeRequirements } from './types';
import Action from './entities/action/action.entity';
import Worker from './entities/worker/worker.entity';
import { Repository } from 'typeorm';
import { ActionState } from './enum';

export async function findWorkerForAction(
    runtime_requirements: RuntimeRequirements,
    workerRepository: Repository<Worker>,
    actionQueue: any,
) {
    const needsGPU = runtime_requirements.gpu_model.name !== 'no-gpu';
    let worker = await workerRepository.find({
        where: { reachable: true, hasGPU: needsGPU },
    });
    console.log(
        `Available Worker (GPU: ${needsGPU}): ${worker.map((a) => a.identifier).join(', ')}`,
    );

    if (worker.length === 0 && !needsGPU) {
        worker = await workerRepository.find({
            where: { reachable: true },
        });
        console.log(
            `Alternative Worker (GPU: any): ${worker.map((a) => a.identifier).join(', ')}`,
        );
    }

    if (worker.length === 0) {
        return;
    }

    const waiting = await actionQueue.getWaiting();
    const nrJobs = {};
    waiting.forEach((job) => {
        const name = job.name.replace('actionProcessQueue-', '');
        if (nrJobs[name]) {
            nrJobs[name] += 1;
        } else {
            nrJobs[name] = 1;
        }
    });
    const res = worker.sort(
        (a, b) => nrJobs[a.identifier] - nrJobs[b.identifier],
    )[0];

    console.log('selected worker', res.identifier);
    return res;
}
export async function addActionQueue(
    action: Action,
    runtime_requirements: RuntimeRequirements,
    workerRepository: any,
    actionRepository: any,
    actionQueue: any,
    logger: any = undefined,
) {
    const worker = await findWorkerForAction(
        runtime_requirements,
        workerRepository,
        actionQueue,
    );
    logger.debug(`Selected worker: ${worker.hostname}`);
    if (!worker) {
        action.state = ActionState.UNPROCESSABLE;
        await actionRepository.save(action);
        return;
    }
    action.worker = worker;
    await actionRepository.save(action);
    try {
        return await actionQueue.add(
            `actionProcessQueue-${worker.identifier}`,
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
