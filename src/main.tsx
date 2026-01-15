

// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import { Amplify } from 'aws-amplify';
// // Import the Authenticator and its props type
// import { Authenticator, AuthenticatorProps } from '@aws-amplify/ui-react';
// import '@aws-amplify/ui-react/styles.css';
// import outputs from '../amplify_outputs.json'; // Adjust path
// import App from './App.tsx';

// Amplify.configure(outputs);

// // --- 1. Define the custom form fields ---
// // NOTE: This 'signUp' configuration won't be visible 
// // since you are hiding the sign-up form.
// const formFields: AuthenticatorProps['formFields'] = {
//   signUp: {
//     phone_number: {
//       order: 3, 
//       label: 'Phone Number',
//       placeholder: 'Enter your phone number (e.g., +15551234567)',
//       isRequired: true,
//     },
//     email: { order: 1 },
//     password: { order: 2 },
//     confirm_password: { order: 4 },
//   },
// };

// // --- 2.  hideSignUp prop ---
// ReactDOM.createRoot(document.getElementById('root')!).render(
//   <>
//     <Authenticator formFields={formFields} hideSignUp={true}>
//       {({ signOut, user }) => (
//        <App signOut={() => signOut && signOut()} user={user} />
//       )}
//     </Authenticator>
//   </>
// );

// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator, AuthenticatorProps } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
// Ensure this path points to your actual amplify_outputs.json file
import outputs from '../amplify_outputs.json'; 
import App from './App.tsx';

// 🔥 CRITICAL: Configure Amplify before the app mounts
Amplify.configure(outputs);

// --- 1. Define the custom form fields ---
const formFields: AuthenticatorProps['formFields'] = {
  signUp: {
    phone_number: {
      order: 3, 
      label: 'Phone Number',
      placeholder: 'Enter your phone number (e.g., +15551234567)',
      isRequired: true,
    },
    email: { order: 1 },
    password: { order: 2 },
    confirm_password: { order: 4 },
  },
};

// --- 2. Render App ---
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Authenticator formFields={formFields} hideSignUp={true}>
      {({ signOut, user }) => (
       <App signOut={() => signOut && signOut()} user={user} />
      )}
    </Authenticator>
  </React.StrictMode>
);