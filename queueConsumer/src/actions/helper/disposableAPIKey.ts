import { KeyTypes } from '@common/enum';
import Mission from '@common/entities/mission/mission.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import { Repository } from 'typeorm';
import logger from '../../logger';

export class DisposableAPIKey implements AsyncDisposable {
    apikeytype: KeyTypes;
    mission: Mission;
    uuid: string;
    apikey: string;

    constructor(
        _apikey: Apikey,
        private apikeyRepository: Repository<Apikey>,
    ) {
        this.apikeyRepository = apikeyRepository;
        this.apikeytype = _apikey.key_type;
        this.mission = _apikey.mission;
        this.uuid = _apikey.uuid;
        this.apikey = _apikey.apikey;
    }

    /**
     * Disposes the API key by setting the deletedAt field to the current date.
     * This will make the API key unusable.
     */
    async [Symbol.asyncDispose]() {
        logger.info(`Disposing API key ${this.uuid}`);
        await this.apikeyRepository.update(
            { uuid: this.uuid },
            { deletedAt: new Date() },
        );
    }
}
