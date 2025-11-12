import React, { useState, useMemo, useEffect } from 'react';
import { useEntityList } from '../DataHook/useEntityList';


// --- Component Setup ---
const classNames = (...classes) => classes.filter(Boolean).join(' ');
// Updated to match the schema's enum values
const statusColors = { 
  ORDERED: 'bg-blue-500', 
  IN_PREPARATION: 'bg-yellow-500', 
  PREPARED: 'bg-green-500', 
  DELIVERED: 'bg-gray-500', 
  DELIVERING: 'bg-orange-500' 
};

/**
 * An Order Management component that fetches its own data from DynamoDB
 * and displays a simple list of all orders for the business.
 * @param {object} props
 * @param {string | null} props.phoneNbr - The phone number of the business owner.
 * @param {Function} props.setModal - A function to open a modal window.
 */
const CustomersView = ({ phoneNbr, setModal }) => {
    const { data: customers, loading, error } = useEntityList(
         {filter: {pk:{ eq: `BUSINESS#${phoneNbr}`} , sk: {beginsWith: 'CUSTOMER#'}}}, "list");

    if (loading) return <div className="p-4 text-center">Loading Customers...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;




return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-orange-500 mb-4">Customers</h1>
            <div className="space-y-3">
                {customers.map(customer => (
                    <div key={customer.sk} 
                    onClick={() => setModal({ type: 'CustomerDetail', IdCustomer: customer.sk })} 
                    className="bg-slate-800 p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-700">
                        <div>
                            <p className="font-bold text-white">{customer.name}</p>
                            <p className="text-amber-400 text-sm ">{customer.sk.split('#')[2]}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-400 text-sm">Total Orders</p>
                            {/* <p className="font-bold text-white">{customer.totalAmount}</p> */}
                            <p className="font-bold text-white">${customer.totalAmount ? customer.totalAmount.toFixed(2) : '0.00'}</p>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default CustomersView;

