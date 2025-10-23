import React from 'react';

// This component receives a `closeModal` function from your parent
const LegalModal = ({ closeModal }) => {
    return (
        // Modal backdrop
        <div 
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" 
            onClick={closeModal} // Close modal when clicking backdrop
        >
            {/* Modal Content */}
            <div 
                className="bg-slate-800 text-slate-300 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-700 sticky top-0 bg-slate-800">
                    <h2 className="text-xl font-bold text-white">Legal Information</h2>
                    <button 
                        onClick={closeModal} 
                        className="text-slate-400 hover:text-white"
                    >
                        {/* Close icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrolling Content Area */}
                <div className="p-6 space-y-6">
                    {/* Terms of Service Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">Terms of Service</h3>
                        <p className="mb-2 text-sm">By using our Service, you agree to be bound by these Terms...</p>
                        <p className="text-sm">1. You may use the Service only to browse the menu and place food orders...</p>
                        <p className="text-sm">2. All orders are subject to acceptance by the restaurant...</p>
                        {/* ...add all your other terms... */}
                    </section>

                    {/* Privacy Policy Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">Privacy Policy</h3>
                        <p className="mb-2 text-sm">This Privacy Policy describes how your personal information is collected...</p>
                        <p className="text-sm">1. We collect your WhatsApp display name, phone number, and order history...</p>
                        <p className="text-sm">2. We use this information to process your orders and greet you by name...</p>
                        {/* ...add all your other privacy policies... */}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default LegalModal;