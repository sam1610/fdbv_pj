// import { generateClient } from 'aws-amplify/data';

// export const client = generateClient();

import { generateClient } from "aws-amplify/api";
import { createAIHooks } from "@aws-amplify/ui-react-ai"; // 👈 New Import

// 1. Create the standard Data Client
export const client = generateClient({ authMode: 'userPool' });

// 2. Generate the AI Hooks from that client
export const { useAIGeneration, useAIConversation } = createAIHooks(client);