import axios from 'axios';
import { config } from '../config.js';

interface ProvisionPayload {
  hireId:   string;
  hireName: string;
  level:    string;
}

export class OktaProvider {
  static async provisionUser(payload: ProvisionPayload): Promise<void> {
    if (!config.oktaDomain || !config.oktaToken) {
      console.log('[Okta MOCK] Would provision user:', payload);
      return;
    }

    const [firstName, ...lastParts] = payload.hireName.split(' ');
    const lastName  = lastParts.join(' ') || 'Unknown';
    const login     = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`;

    await axios.post(
      `https://${config.oktaDomain}/api/v1/users?activate=true`,
      {
        profile: { firstName, lastName, email: login, login },
        groupIds: payload.level === 'EXEC' ? ['exec-group-id'] : [],
      },
      {
        headers: {
          Authorization: `SSWS ${config.oktaToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    console.log(`[Okta] ✅ Provisioned user: ${login}`);
  }
}
