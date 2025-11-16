import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json'; 

export const client = generateClient({
  ...outputs.data, 
});