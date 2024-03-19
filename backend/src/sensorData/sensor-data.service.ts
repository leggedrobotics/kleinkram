import { Injectable } from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import SensorData from "./entities/sensor-data.entity";

@Injectable()
export class SensorDataService {
    constructor(@InjectRepository(SensorData) private sensorDataRepository: Repository<SensorData>){}
    
    async findAll() {
        return this.sensorDataRepository.find();
    }
    
    async findOne(uuid: string) {
        return this.sensorDataRepository.findOne({where: {uuid}});
    }
    
    async create(createSensorData: SensorData){
        
        const newSensorData = this.sensorDataRepository.create(createSensorData);
        return this.sensorDataRepository.save(newSensorData);
    }
}
