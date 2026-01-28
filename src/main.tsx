

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
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { 
  Authenticator, 
  AuthenticatorProps, 
  View, 
  Button, 
  useAuthenticator 
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json'; 
import App from './App.tsx';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal'; // ✅ Make sure you created this file!

// 1. Configure Amplify
Amplify.configure(outputs);

// 2. Form Fields Config
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

// 3. Custom Footer Component (Contains Forgot Password & Privacy Link)
const CustomSignInFooter = ({ onOpenPrivacy }: { onOpenPrivacy: () => void }) => {
  const { toForgotPassword } = useAuthenticator();

  return (
    <View textAlign="center" padding="1rem" display="flex" flexDirection="column" gap="0.5rem">
      {/* Restore Forgot Password Button */}
      <Button
        variation="link"
        onClick={toForgotPassword}
        size="small"
        style={{ fontWeight: 'normal', fontSize: '0.85rem' }}
      >
        Forgot your password?
      </Button>

      {/* ✅ The New Privacy Policy Button */}
      <Button 
        variation="link" 
        onClick={onOpenPrivacy}
        style={{ fontWeight: 'normal', fontSize: '0.85rem', color: '#64748b' }}
      >
        Privacy Policy
      </Button>
    </View>
  );
};

// 4. Wrapper Component (Manages Modal State)
const AuthWrapper = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <>
      {/* The Privacy Modal (Hidden by default) */}
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}

      <Authenticator 
        formFields={formFields} 
        hideSignUp={true}
        components={{
          SignIn: {
            // Inject our custom footer into the Sign In slot
            Footer: () => <CustomSignInFooter onOpenPrivacy={() => setShowPrivacy(true)} />
          }
        }}
      >
        {({ signOut, user }) => (
           <App signOut={() => signOut && signOut()} user={user} />
        )}
      </Authenticator>
    </>
  );
};

// 5. Render
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthWrapper />
  </React.StrictMode>
);