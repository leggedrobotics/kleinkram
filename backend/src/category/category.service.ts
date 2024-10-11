import { Injectable } from '@nestjs/common';
import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Category from '@common/entities/category/category.entity';
import { AuthRes } from '../auth/paramDecorator';

@Injectable()
export class CategoryService {
    constructor(
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
    ) {}

    async getAll(projectUUID: string, filter?: string) {
        const where = {
            project: { uuid: projectUUID },
        };
        if (filter) {
            where['name'] = ILike(`%${filter}%`);
        }
        return this.categoryRepository.findAndCount({
            where,
        });
    }

    async create(name: string, projectUUID: string, user: AuthRes) {
        const category = this.categoryRepository.create({
            name,
            project: { uuid: projectUUID },
            creator: user.user,
        });
        const saved = await this.categoryRepository.save(category);
        return this.categoryRepository.findOneOrFail({
            where: { uuid: saved.uuid },
        });
    }

    async addManyCategories(
        missionUUID: string,
        files: string[],
        categories: string[],
        user: AuthRes,
    ) {
        // Step 1: Validate that the files belong to the mission in one query
        const validFileIds = await this.fileEntityRepository
            .createQueryBuilder('file')
            .select('file.uuid')
            .innerJoin('file.mission', 'mission')
            .where('mission.uuid = :missionUUID', { missionUUID })
            .andWhere('file.uuid IN (:...files)', { files })
            .getMany();

        const validFileUUIDs = validFileIds.map((file) => file.uuid);

        if (validFileUUIDs.length !== files.length) {
            throw new Error('Some files do not belong to the given mission.');
        }
        console.log('validFileUUIDs', validFileUUIDs);

        const insertValues = validFileUUIDs.flatMap((fileUUID) =>
            categories.map((categoryUUID) => ({
                fileEntityUuid: fileUUID,
                categoryUuid: categoryUUID,
            })),
        );
        console.log('insertValues', insertValues);

        if (insertValues.length > 0) {
            await this.fileEntityRepository.manager
                .createQueryBuilder()
                .insert()
                .into('file_entity_categories_category') // The join table for file and category
                .values(insertValues)
                .orIgnore()
                .execute();
        }

        return { success: true };
    }
}
