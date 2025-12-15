import { ApiKeyEntity, MissionEntity } from '@kleinkram/backend-common';
import { KeyTypes } from '@kleinkram/shared';
import { Repository } from 'typeorm';
import logger from '../../logger';

export class DisposableAPIKey implements AsyncDisposable {
    apikeyType: KeyTypes;
    mission: MissionEntity;
    uuid: string;
    apikey: string;

    constructor(
        _apikey: ApiKeyEntity,
        private apikeyRepository: Repository<ApiKeyEntity>,
    ) {
        this.apikeyRepository = apikeyRepository;
        this.apikeyType = _apikey.key_type;
        this.mission = _apikey.mission;
        this.uuid = _apikey.uuid;
        this.apikey = _apikey.apikey;
    }

    /**
     * Disposes the API key by setting the deletedAt field to the current date.
     * This will make the API key unusable.
     */
    async [Symbol.asyncDispose](): Promise<void> {
        logger.info(`Disposing API key ${this.uuid}`);
        await this.apikeyRepository.update(
            { uuid: this.uuid },
            { deletedAt: new Date() },
        );
    }
}
