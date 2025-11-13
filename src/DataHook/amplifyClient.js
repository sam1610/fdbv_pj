import { generateClient } from 'aws-amplify/data';

// 1. Generate the client a single time.
export const client = generateClient({ authMode: 'apiKey' });

// 2. Export it so all other components can import it.