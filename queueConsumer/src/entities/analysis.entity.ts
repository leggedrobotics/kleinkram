import { Column, Entity, ManyToOne } from 'typeorm';
import Run from "./run.entity";
import BaseEntity from "../base-entity.entity";

@Entity()
export default class AnalysisRun extends BaseEntity {
    @Column()
    state: string;

    @Column()
    docker_image: string;

    @ManyToOne(() => Run, (run) => run.files)
    run: Run;
}
