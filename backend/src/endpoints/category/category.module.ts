import { CategoryService } from '@/services/category.service';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryController } from './category.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([CategoryEntity, ProjectEntity, FileEntity]),
    ],
    providers: [CategoryService],
    controllers: [CategoryController],
    exports: [CategoryService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CategoryModule {}
