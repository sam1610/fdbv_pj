

// main.tsx
import outputs from '../amplify_outputs.json'; 
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
import App from './App.tsx';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal'; 

Amplify.configure(outputs);

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

const CustomSignInFooter = ({ onOpenPrivacy }: { onOpenPrivacy: () => void }) => {
  const { toForgotPassword } = useAuthenticator();
  return (
<View 
      textAlign="center" 
      padding="1rem" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.5rem' 
      }}
    >      <Button
        variation="link"
        onClick={toForgotPassword}
        size="small"
        style={{ fontWeight: 'normal', fontSize: '0.85rem' }}
      >
        Forgot your password?
      </Button>
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

const AuthWrapper = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <>
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
      <Authenticator 
        formFields={formFields} 
        hideSignUp={true}
        components={{
          SignIn: {
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

// 🔥 THE FIX: CHECK URL BEFORE RENDERING
// If the URL is exactly "/privacy.html", we skip the App/Login and just show the Policy.
// const root = ReactDOM.createRoot(document.getElementById('root')!);

// if (window.location.pathname === '/privacy.html') {
//   root.render(
//     <React.StrictMode>
//        {/* Redirect to home when they close the modal */}
//        <PrivacyPolicyModal onClose={() => window.location.href = '/'} />
//     </React.StrictMode>
//   );
// } else {
//   // Normal App Load
//   root.render(
//     <React.StrictMode>
//       <AuthWrapper />
//     </React.StrictMode>
//   );
// }

const container = document.getElementById('root');

if (container) {
  // Only create the root if it doesn't look like it's already handled (mostly for HMR safety)
  const root = ReactDOM.createRoot(container);

  if (window.location.pathname === '/privacy.html') {
    root.render(
      <React.StrictMode>
         <PrivacyPolicyModal onClose={() => window.location.href = '/'} />
      </React.StrictMode>
    );
  } else {
    root.render(
      <React.StrictMode>
        <AuthWrapper />
      </React.StrictMode>
    );
  }
}