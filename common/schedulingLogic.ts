import { RuntimeRequirements } from './types';
import Action from './entities/action/action.entity';
import Worker from './entities/worker/worker.entity';
import { Repository } from 'typeorm';

export async function findWorkerForAction(
    runtime_requirements: RuntimeRequirements,
    workerRepository: Repository<Worker>,
    actionQueue: any,
) {
    const needsGPU = runtime_requirements.gpu_model.name !== 'no-gpu';
    console.log('needsGPU', needsGPU);
    let worker = await workerRepository.find({
        where: { reachable: true, hasGPU: needsGPU },
    });
    console.log('worker', worker);

    if (worker.length === 0 && !needsGPU) {
        console.log('no worker found, trying without GPU');
        worker = await workerRepository.find({
            where: { reachable: true },
        });
        console.log('worker', worker);
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
    return worker.sort(
        (a, b) => nrJobs[a.identifier] - nrJobs[b.identifier],
    )[0];
}
export async function addActionQueue(
    action: Action,
    runtime_requirements: RuntimeRequirements,
    workerRepository: any,
    actionRepository: any,
    actionQueue: any,
) {
    const worker = await findWorkerForAction(
        runtime_requirements,
        workerRepository,
        actionQueue,
    );
    if (!worker) {
        return;
    }
    action.worker = worker;
    await actionRepository.save(action);
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
}
