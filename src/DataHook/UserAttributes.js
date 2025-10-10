import React, { useState, useMemo, useEffect } from 'react';

import { fetchUserAttributes } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';

const client = generateClient({ authMode: 'userPool' });

function UserAttributes( phoneNbr) {
  // 1. Create state for the phone number and the final data
  console.log("UserAttributes Hook Called", phoneNbr);

return { phoneNbr}
}