import React, { useState, useMemo, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';

// --- Component Setup ---
const client = generateClient({ authMode: 'userPool' });


/**
 * An Order Management component that fetches its own data from DynamoDB
 * and displays a simple list of all orders for the business.
 * @param {object} props
 * @param {string | null} props.phoneNbr - The phone number of the business owner.
 * @param {Function} props.setModal - A function to open a modal window.
 */
const ListPK = ({ phoneNbr,  flt}) => {
    // We only need one state for the raw data fetched from the API
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Data Fetching Logic ---
    useEffect(() => {
        if (!phoneNbr) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const allRecords = [];
                let nextToken = null;
                const pk = `BUSINESS#${phoneNbr}`;

                do {
                    const response = await client.models.BusinessData.listBusinessDataByPkAndSk({
                        pk: pk,
                        sk: { beginsWith: 'CUSTOMER#' }, // Only fetch Order records
                        nextToken: nextToken,
                    });
                    const items = response.data || [];
                    allRecords.push(...items);
                    nextToken = response.nextToken;
                } while (nextToken);

                console.log("Fetched all orders for business:", allRecords);
                setAllItems(allRecords);
            } catch (err) {
                const msg = err.errors ? err.errors[0].message : err.message;
                setError(`Failed to fetch orders: ${msg}`);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [phoneNbr]);

    // ✅ FIX: The component now correctly derives the 'orders' list from 'allItems'
    // using useMemo. This prevents infinite re-renders.
    const customers = useMemo(() => {
        // A guard clause to ensure allItems is a valid array
        if (!Array.isArray(allItems)) return [];
        // The data fetching is already filtering by 'ORDER#', so we can just use it directly.
        return allItems;
    }, [allItems]);
    return { customers, loading, error };