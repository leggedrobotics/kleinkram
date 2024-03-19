import {Column, Entity, ManyToOne} from "typeorm";
import BaseEntity from "../../base-entity.entity";
import Run from "../../run/entities/run.entity";

@Entity()
export default class SensorData extends BaseEntity{
    @ManyToOne(() => Run, run => run.sensorData)
    run: Run;
}