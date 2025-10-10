import React, { useState, useMemo } from 'react';

const CustomersView = ({ customers, setModal }) => {
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-white mb-4">Customers</h1>
            <div className="space-y-3">
                {customers.map(customer => (
                    <div key={customer.SortKey} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{customer.CustomerName}</p>
                            <p className="text-sm text-slate-400">{customer.SortKey.split('#')[1]}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-400 text-sm">Total Orders</p>
                            <p className="font-bold text-white">{customer.TotalOrders}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default CustomersView;

