import {Column, Entity, OneToMany} from "typeorm";
import BaseEntity from "../../base-entity.entity";
import Run from "../../run/entities/run.entity";

@Entity()
export default class Project extends BaseEntity{
    @Column()
    name: string;

    @OneToMany(() => Run, run => run.project)
    runs: Run[];
}