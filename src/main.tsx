

// main.tsx
import outputs from '../amplify_outputs.json'; 
import React, { useState, useEffect } from 'react';
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
  // Add a state to track if Amplify is actually ready
  const [isAmplifyConfigured, setIsAmplifyConfigured] = useState(false);

  useEffect(() => {
    try {
      Amplify.configure(outputs);
      console.log("DEBUG: Amplify Configuration Successful");
      setIsAmplifyConfigured(true);
    } catch (e) {
      console.error("DEBUG: Amplify Configuration Failed", e);
    }
  }, []);

  if (!isAmplifyConfigured) {
    return <div style={{color: 'white', padding: '20px'}}>Initializing AWS Connection...</div>;
  }

  return (
    <>
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
      <Authenticator 
        // ... your existing props
      >
        {({ signOut, user }) => (
           <App signOut={() => signOut && signOut()} user={user} />
        )}
      </Authenticator>
    </>
  );
};


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