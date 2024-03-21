import { Injectable } from '@nestjs/common';
import { convert } from '../service/converter';

@Injectable()
export class AppService {
  async convertFile(file: Express.Multer.File): Promise<void> {
    const res = await convert(file, { indexed: true });
  }
}
