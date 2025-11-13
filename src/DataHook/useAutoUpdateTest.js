import { useEffect } from 'react';
import { client } from './amplifyClient';

const useAutoUpdateTest = () => {
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        console.log('🔄 Auto-update test starting...');
        
        const updatedOrder = await client.models.BusinessData.update({
          pk: 'BUSINESS#+97333787388',
          sk: 'ORDER#2025-11-13T08:53:53.173Z',
          orderStatus: 'PREPARED',
        });
        
        console.log('✅ Test mutation executed:', updatedOrder);
      } catch (mutationErr) {
        console.error('❌ Mutation error:', mutationErr);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, []);
};

export default useAutoUpdateTest;