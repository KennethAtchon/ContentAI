export interface SaveService {
    flushNow(): Promise<void>; // transport, keyboard, mutations call this
    cancelPending(): void;
}