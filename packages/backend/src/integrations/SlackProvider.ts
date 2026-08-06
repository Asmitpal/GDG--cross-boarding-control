import axios from 'axios';
import { config } from '../config.js';

interface SLABreachPayload {
  hireName:    string;
  taskLabel:   string;
  owner:       string;
  overdueHours: number;
  slaHours:    number;
}

export class SlackProvider {
  private static get webhookUrl(): string {
    return config.slackWebhook;
  }

  private static async post(payload: object): Promise<void> {
    if (!SlackProvider.webhookUrl) {
      console.log('[Slack MOCK]', JSON.stringify(payload, null, 2));
      return;
    }
    await axios.post(SlackProvider.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
  }

  /** Block Kit message when an approval request is generated */
  static async sendApprovalRequest(hireName: string, jobTitle: string, managerName: string): Promise<void> {
    await SlackProvider.post({
      text: `🔔 New approval request for *${hireName}*`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🔔 Approval Required', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Candidate:*\n${hireName}` },
            { type: 'mrkdwn', text: `*Role:*\n${jobTitle}` },
            { type: 'mrkdwn', text: `*Manager:*\n${managerName}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'Review and approve/reject access in the Cross-Boarding Control panel.' },
        },
        { type: 'divider' },
      ],
    });
  }

  /** Notification when approval is resolved */
  static async sendApprovalResult(
    hireName: string,
    decision: string,
    resolvedBy?: string,
  ): Promise<void> {
    const emoji  = decision === 'APPROVED' ? '✅' : '❌';
    const status = decision === 'APPROVED' ? 'approved' : 'rejected';

    await SlackProvider.post({
      text: `${emoji} Access request for *${hireName}* has been *${status}*${resolvedBy ? ` by ${resolvedBy}` : ''}.`,
    });
  }

  /** Block Kit alert when an SLA is breached */
  static async sendSLABreach(payload: SLABreachPayload): Promise<void> {
    await SlackProvider.post({
      text: `⚠️ SLA breach: ${payload.taskLabel} for ${payload.hireName}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '⚠️ SLA Breach Detected', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Task:*\n${payload.taskLabel}` },
            { type: 'mrkdwn', text: `*Hire:*\n${payload.hireName}` },
            { type: 'mrkdwn', text: `*Owner:*\n${payload.owner}` },
            { type: 'mrkdwn', text: `*Overdue by:*\n${payload.overdueHours}h (SLA: ${payload.slaHours}h)` },
          ],
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: 'Action required — check the Cross-Boarding Escalations feed.' }],
        },
      ],
    });
  }
}
