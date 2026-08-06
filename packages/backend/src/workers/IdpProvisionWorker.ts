import { Worker } from 'bullmq';
import { redisConnection } from './queues.js';
import { OktaProvider } from '../integrations/OktaProvider.js';
import { GithubProvider } from '../integrations/GithubProvider.js';
import { prisma } from '../db.js';

export function startIdpProvisionWorker() {
  const worker = new Worker(
    'idp-provision',
    async (job) => {
      const { hireId, taskId, system, hireName, level } = job.data;
      console.log(`[IdpWorker] Provisioning ${system} for ${hireName}…`);

      try {
        switch (system) {
          case 'Okta':
            await OktaProvider.provisionUser({ hireId, hireName, level });
            break;
          case 'GitHub':
            await GithubProvider.addOrgMember({ hireName });
            break;
          default:
            console.log(`[IdpWorker] No adapter for system "${system}" — marking complete.`);
        }

        // Mark task as DONE after successful provisioning
        await prisma.taskGraph.update({
          where: { id: taskId },
          data:  { status: 'DONE', completedAt: new Date() },
        });

        console.log(`[IdpWorker] ✅ Provisioned ${system} for ${hireName}`);
      } catch (err) {
        console.error(`[IdpWorker] ❌ Failed to provision ${system} for ${hireName}:`, err);
        throw err; // let BullMQ retry
      }
    },
    { connection: redisConnection, concurrency: 3 },
  );

  worker.on('failed', (job, err) =>
    console.error(`[IdpWorker] Job failed after retries:`, err),
  );

  return worker;
}
