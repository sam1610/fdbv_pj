import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json'; // Adjust path
import App from './App.tsx';

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
<Authenticator>
      {({ signOut, user }: { signOut: () => void; user: { username: string } | null }) => <App signOut={signOut} user={user} />}
    </Authenticator>
  </React.StrictMode>
);