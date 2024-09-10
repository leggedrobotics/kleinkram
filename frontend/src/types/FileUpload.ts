export class FileUpload {
    name: string;
    size: number;
    uploaded: number;
    startTime: Date;
    canceled: boolean = false;
    constructor(name: string, size: number) {
        this.name = name;
        this.size = size;
        this.uploaded = 0;
        this.startTime = new Date();
    }
    public getProgress(): number {
        return this.uploaded / this.size;
    }
    public getRemainingTime(): number {
        const progress = this.getProgress();
        if (progress === 0) {
            return 0;
        }
        const elapsedTime =
            (new Date().getTime() - this.startTime.getTime()) / 1000;
        return elapsedTime / progress - elapsedTime;
    }

    get speed(): number {
        const elapsedTime =
            (new Date().getTime() - this.startTime.getTime()) / 1000;
        return this.uploaded / elapsedTime;
    }
    get completed(): boolean {
        return this.uploaded === this.size || this.canceled;
    }
}
