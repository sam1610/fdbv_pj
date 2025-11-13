
import { client } from './amplifyClient';


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