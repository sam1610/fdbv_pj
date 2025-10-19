import { generateClient } from 'aws-amplify/api';

const client = generateClient({ authMode: 'userPool' });

/**
 * Updates multiple records in the BusinessData model via AppSync/GraphQL mutations.
 * This function handles batch updates for multiple sort keys (sks) with the same partition key (pk) and updates object.
 * It uses Promise.all for parallel execution to minimize latency, while keeping RCU costs low (individual mutations).
 * 
 * @param {string} pk - The common partition key for all records (e.g., 'BUSINESS#+97333787388').
 * @param {string[]} sks - Array of sort keys to update (e.g., ['ORDER#2025-10-12T01:00:00.000Z', 'ORDER#2025-10-12T15:30:00.000Z']).
 * @param {Object} updates - Object with fields to update for all records (e.g., { gsi1pk: 'AGENT#+97333787388#+97388877722', orderStatus: 'Delivering' }).
 * @returns {Promise<Object[]>} Array of updated records from the mutation responses.
 * @throws {Error} If any update fails (rolls back none; handle partial success in caller).
 * 
 * Amplify CLI Notes:
 * - Ensure your schema.graphql defines BusinessData with @model and mutable fields like gsi1pk.
 * - Run `amplify codegen models` after schema changes, then `amplify push` to deploy.
 * - For CI/CD: Integrate with Amplify Console or GitHub Actions via `amplify configure` and add a pipeline with `amplify pipeline-deploy` for automated deploys on merges/PRs.
 */
export async function updateRec(pk, sks, updates) {
  if (!pk || !Array.isArray(sks) || sks.length === 0 || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    throw new Error('Invalid parameters: pk, non-empty sks array, and non-empty updates object are required.');
  }

  try {
    const updatePromises = sks.map(sk => 
      client.models.BusinessData.update({
        pk,
        sk,
        ...updates
      })
    );

    const responses = await Promise.all(updatePromises);
    console.log('Records updated successfully:', responses);
    return responses;
  } catch (err) {
    const msg = err.errors ? err.errors[0].message : 'An unknown error occurred.';
    console.error('Batch update failed:', err);
    throw new Error(`Failed to update records: ${msg}`);
  }
}