import type { IQueueRepository } from "./queue.repository";

export class QueueService {
  constructor(private readonly queue: IQueueRepository) {}

  countScheduledForUser(userId: string) {
    return this.queue.countScheduledByUserId(userId);
  }
}
