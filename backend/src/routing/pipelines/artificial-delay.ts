import { PipeTransform } from '@nestjs/common';

export class DelayPipe implements PipeTransform {
    constructor(private delay: number) {}

    async transform(value: any) {
        await new Promise((resolve) => setTimeout(resolve, this.delay));
        return value;
    }
}
