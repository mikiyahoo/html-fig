import { QueueClient } from "@vercel/queue";

const queue = new QueueClient({ region: process.env.VERCEL_REGION || "iad1" });

export const { send, handleCallback } = queue;
