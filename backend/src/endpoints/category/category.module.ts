import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Category from '@common/entities/category/category.entity';
import Project from '@common/entities/project/project.entity';
import FileEntity from '@common/entities/file/file.entity';
import { CategoryService } from '../../services/category.service';
import { CategoryController } from './category.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Category, Project, FileEntity])],
    providers: [CategoryService],
    controllers: [CategoryController],
    exports: [CategoryService],
})
export class CategoryModule {}
