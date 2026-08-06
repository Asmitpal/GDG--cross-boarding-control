import axios from 'axios';
import { config } from '../config.js';

interface AddMemberPayload {
  hireName: string;
}

export class GithubProvider {
  static async addOrgMember(payload: AddMemberPayload): Promise<void> {
    if (!config.githubOrg || !config.githubToken) {
      console.log('[GitHub MOCK] Would add org member:', payload);
      return;
    }

    const username = payload.hireName.toLowerCase().replace(/\s+/g, '.');

    await axios.put(
      `https://api.github.com/orgs/${config.githubOrg}/memberships/${username}`,
      { role: 'member' },
      {
        headers: {
          Authorization: `token ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
        },
        timeout: 10000,
      },
    );

    console.log(`[GitHub] ✅ Added ${username} to org ${config.githubOrg}`);
  }
}
