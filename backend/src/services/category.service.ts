import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import { CategoriesDto } from '@kleinkram/api-dto';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    FindOptionsWhere,
    ILike,
    In,
    QueryFailedError,
    Repository,
} from 'typeorm';

const categoryNameTaken = (name: string): ConflictException =>
    new ConflictException(
        `A category named "${name}" already exists in this project`,
    );

@Injectable()
export class CategoryService {
    constructor(
        @InjectRepository(CategoryEntity)
        private categoryRepository: Repository<CategoryEntity>,
        @InjectRepository(FileEntity)
        private fileEntityRepository: Repository<FileEntity>,
    ) {}

    async getAll(projectUUID: string, filter?: string): Promise<CategoriesDto> {
        const where: FindOptionsWhere<CategoryEntity> = {
            project: { uuid: projectUUID },
        };
        if (filter) {
            where.name = ILike(`%${filter}%`);
        }
        const [categories, count] = await this.categoryRepository.findAndCount({
            where,
        });

        return {
            count,
            data: categories.map((category) => ({
                uuid: category.uuid,
                name: category.name,
                description: category.description,
            })),
            take: count,
            skip: 0,
        };
    }

    /**
     * Creates a category in the given project.
     *
     * Category names are unique per project (soft-deleted categories don't
     * count, see the `unique_category_name_per_project` index). A taken name is
     * reported as 409 Conflict: the check up front gives the common case a
     * clear message, the unique violation catches two requests racing for the
     * same name.
     */
    async create(
        name: string,
        projectUUID: string,
        user: AuthHeader,
        description = '',
    ) {
        const exists = await this.categoryRepository.exists({
            where: { name, project: { uuid: projectUUID } },
        });
        if (exists) throw categoryNameTaken(name);

        const category = this.categoryRepository.create({
            name,
            description,
            project: { uuid: projectUUID },
            creator: user.user,
        });

        try {
            const saved = await this.categoryRepository.save(category);
            return await this.categoryRepository.findOneOrFail({
                where: { uuid: saved.uuid },
            });
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error.driverError?.code === '23505'
            ) {
                throw categoryNameTaken(name);
            }
            throw error;
        }
    }

    /**
     * Updates the description of a category.
     *
     * The project uuid is the resource the caller was authorized against, so
     * the category is only updated if it actually belongs to that project.
     */
    async updateDescription(
        uuid: string,
        projectUUID: string,
        description: string,
    ) {
        const category = await this.categoryRepository.findOne({
            where: { uuid, project: { uuid: projectUUID } },
        });

        if (!category) {
            throw new NotFoundException(
                'Category not found in the given project',
            );
        }

        category.description = description;
        return this.categoryRepository.save(category);
    }

    /**
     * Adds categories to files of a mission.
     *
     * The files must be in the mission and the categories must belong to
     * the mission's project: a category of another project would show up on
     * files where it can't be selected or managed.
     */
    async addManyCategories(
        missionUUID: string,
        files: string[],
        categories: string[],
    ) {
        const fileUUIDs = [...new Set(files)];
        const categoryUUIDs = [...new Set(categories)];
        if (fileUUIDs.length === 0) {
            throw new BadRequestException('Select at least one file');
        }
        if (categoryUUIDs.length === 0) {
            throw new BadRequestException('Select at least one category');
        }

        const filesInMission = await this.fileEntityRepository.find({
            where: { uuid: In(fileUUIDs), mission: { uuid: missionUUID } },
            relations: { mission: { project: true } },
            select: {
                uuid: true,
                mission: { uuid: true, project: { uuid: true } },
            },
        });
        if (filesInMission.length !== fileUUIDs.length) {
            throw new BadRequestException(
                "Some files don't belong to this mission",
            );
        }
        const projectUUID = filesInMission[0]?.mission?.project?.uuid;

        const existingCategories = await this.categoryRepository.find({
            where: { uuid: In(categoryUUIDs) },
            relations: { project: true },
            select: { uuid: true, project: { uuid: true } },
        });
        if (existingCategories.length !== categoryUUIDs.length) {
            throw new NotFoundException('Category not found');
        }
        if (
            existingCategories.some(
                (category) => category.project?.uuid !== projectUUID,
            )
        ) {
            throw new BadRequestException(
                "Categories must belong to the mission's project",
            );
        }

        const insertValues = fileUUIDs.flatMap((fileUUID) =>
            categoryUUIDs.map((categoryUUID) => ({
                fileEntityUuid: fileUUID,
                categoryUuid: categoryUUID,
            })),
        );

        await this.fileEntityRepository.manager
            .createQueryBuilder()
            .insert()
            .into('file_entity_categories_category') // The join table for file and category
            .values(insertValues)
            .orIgnore()
            .execute();

        return { success: true };
    }
}
