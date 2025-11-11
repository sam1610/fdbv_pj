// src/context/BusinessDataContext.js
import React, { createContext, useContext, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';

const client = generateClient({ authMode: 'apiKey' });

const BusinessDataContext = createContext();

export const BusinessDataProvider = ({ phoneNbr="+97333787388", children }) => {
  // Subscriptions using Gen2 model-based API (only onCreate)
  useEffect(() => {
    console.log("Setting up create subscription...");

    // On Create
    const createSub = client.models.BusinessData.onCreate().subscribe({
      next: (newRecord) => {
        if (newRecord.pk === `BUSINESS#${phoneNbr}` && newRecord.sk.startsWith('ORDER#')) {
          console.log("New message added");
        }
      },
      error: (err) => {
        console.error('Subscription error (create):', err);
      },
    });

    // Cleanup
    return () => {
      console.log("Tearing down create subscription.");
      createSub.unsubscribe();
    };
  }, [phoneNbr]); // Depend on phoneNbr for resubscription

  return (
    <BusinessDataContext.Provider value={{ phoneNbr }}>  // Initialized with shared data
      {children}
    </BusinessDataContext.Provider>
  );
};

export const useBusinessData = () => useContext(BusinessDataContext);