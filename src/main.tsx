// // import React from 'react';
// // import ReactDOM from 'react-dom/client';
// // import { Amplify } from 'aws-amplify';
// // import { Authenticator } from '@aws-amplify/ui-react';
// // import '@aws-amplify/ui-react/styles.css';
// // import outputs from '../amplify_outputs.json'; // Adjust path
// // import App from './App.tsx';

// // Amplify.configure(outputs);

// // ReactDOM.createRoot(document.getElementById('root')!).render(
// //   <>
// // <Authenticator>
// //       {({ signOut, user }: { signOut: () => void; user: { username: string } | null }) => <App signOut={signOut} user={user} />}
// //     </Authenticator>
// //   </>
// // );





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
// // This tells the Authenticator to add a "phone_number" field
// const formFields: AuthenticatorProps['formFields'] = {
//   signUp: {
//     phone_number: {
//       order: 3, // Puts it after email (1) and password (2)
//       label: 'Phone Number',
//       placeholder: 'Enter your phone number (e.g., +15551234567)',
//       isRequired: true,
//     },
//     // We can also re-order the defaults
//     email: { order: 1 },
//     password: { order: 2 },
//     confirm_password: { order: 4 }, // Make sure this comes after phone_number
//   },
// };

// // --- 2. Render the Authenticator with the formFields prop ---
// ReactDOM.createRoot(document.getElementById('root')!).render(
//   <>
//     <Authenticator formFields={formFields}>
//       {({ signOut, user }) => (
//        <App signOut={() => signOut && signOut()} user={user} />
//       )}
//     </Authenticator>
//   </>
// );

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
// Import the Authenticator and its props type
import { Authenticator, AuthenticatorProps } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json'; // Adjust path
import App from './App.tsx';

Amplify.configure(outputs);

// --- 1. Define the custom form fields ---
// NOTE: This 'signUp' configuration won't be visible 
// since you are hiding the sign-up form.
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

// --- 2.  hideSignUp prop ---
ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <Authenticator formFields={formFields} hideSignUp={true}>
      {({ signOut, user }) => (
       <App signOut={() => signOut && signOut()} user={user} />
      )}
    </Authenticator>
  </>
);