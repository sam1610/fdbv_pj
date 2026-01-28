import React from 'react';

export const PrivacyPolicyModal = ({ onClose }: { onClose: () => void }) => {
  return (
    // 1. Overlay (Dark background)
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      
      {/* 2. Modal Container (White/Dark Box) */}
      <div className="bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        
        {/* 3. Fixed Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800 shrink-0">
            <h2 className="text-emerald-400 font-bold uppercase tracking-widest text-sm">Privacy Policy</h2>
            <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
            >
                ✕
            </button>
        </div>

        {/* 4. Scrollable Content Area */}
        <div className="overflow-y-auto p-6 space-y-6 text-slate-300 text-sm leading-relaxed custom-scrollbar bg-slate-900">
            
            <header className="border-l-4 border-emerald-500 pl-4 mb-6">
                <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
                <p className="text-xs text-emerald-400 mt-1 uppercase tracking-widest">Effective Date: January 28, 2026</p>
            </header>

            <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-xl text-sm leading-relaxed">
                
                {/* 1. Introduction */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">1. Introduction</h3>
                    <p>
                        Welcome to <strong className="text-white">CloudOrder</strong> (operated by <strong>1st-Hub</strong>). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our services, including our web dashboard and our WhatsApp-based ordering system.
                    </p>
                    <p className="mt-2">By using our services, you agree to the collection and use of information in accordance with this policy.</p>
                </section>

                {/* 2. Information We Collect */}
                <section className="mt-6">
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">2. Information We Collect</h3>
                    <p className="mb-2">We collect information to provide and improve our services. The types of data collected include:</p>
                    
                    <div className="pl-4 border-l-2 border-slate-600 space-y-3">
                        <div>
                            <h4 className="text-emerald-400 font-bold text-xs uppercase">A. Information You Provide to Us</h4>
                            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                                <li><strong>Merchants:</strong> Business Name, Address, Contact Details, Menu data.</li>
                                <li><strong>End-Users (WhatsApp):</strong> Phone Number, Profile Name, Location Data (GPS for delivery), Order Details.</li>
                            </ul>
                        </div>
                        <div>
                            {/* Explicit Meta Platform Data Section */}
                            <h4 className="text-emerald-400 font-bold text-xs uppercase">B. Meta Platform Data (WhatsApp)</h4>
                            <p className="text-xs text-slate-500 mb-1">Data we receive from Meta via the WhatsApp Business Cloud API:</p>
                            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                                <li><strong>WhatsApp User ID (Phone Number):</strong> Used to identify customers and route messages.</li>
                                <li><strong>Message Content:</strong> Incoming messages, flow interactions, and order selections.</li>
                                <li><strong>Profile Name:</strong> The public display name associated with the WhatsApp account.</li>
                                <li><strong>Meta Access Tokens:</strong> Used securely to authenticate API requests on behalf of the business.</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-emerald-400 font-bold text-xs uppercase">C. Information Collected Automatically</h4>
                            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                                <li><strong>Log Data:</strong> IP addresses, browser type, access times.</li>
                                <li><strong>Usage Data:</strong> Interaction metrics with the WhatsApp bot.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 3. Usage */}
                <section className="mt-6">
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">3. How We Use Your Information</h3>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Service Delivery:</strong> Processing orders and routing to restaurant branches.</li>
                        <li><strong>Communication:</strong> Sending automated order confirmations, delivery updates, and receipts via WhatsApp.</li>
                        <li><strong>Meta Platform Integration:</strong> We use Meta Platform Data solely to facilitate the messaging experience between the Business (Restaurant) and the End-User (Customer). We do not use this data for surveillance or independent marketing profiles.</li>
                        <li><strong>Location Services:</strong> Calculating delivery fees and guiding delivery agents.</li>
                    </ul>
                </section>

                {/* 4. Sharing */}
                <section className="mt-6">
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">4. Data Sharing & Third Parties</h3>
                    <p>We do not sell your personal data. We share data only with necessary providers:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>Meta Platforms (WhatsApp):</strong> Message content and phone numbers are shared with Meta to transmit messages via the WhatsApp Cloud API.</li>
                        <li><strong>AWS:</strong> For secure cloud hosting and database storage.</li>
                        <li><strong>Restaurant Partners:</strong> Order details are shared strictly with the specific restaurant fulfilling your order.</li>
                    </ul>
                </section>

                {/* 5. Retention & Deletion */}
                <section className="mt-6">
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">5. Data Retention & Deletion</h3>
                    <p>We retain data only as long as necessary to provide our services and comply with legal obligations.</p>
                    
                    <div className="bg-slate-900/50 p-4 rounded-lg mt-3 border border-slate-600">
                        <h4 className="text-white font-bold text-xs uppercase mb-1">Requesting Data Deletion</h4>
                        <p className="text-xs text-slate-400 mb-2">
                            You have the right to request the deletion of your personal data, including data received from Meta.
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400 mb-3">
                            <li><strong>Merchants:</strong> Can request account deletion via their account settings or email.</li>
                            <li><strong>End-Users:</strong> Can request deletion of their chat history and profile data from our systems.</li>
                        </ul>
                        <div className="bg-slate-800 p-3 rounded border border-slate-700">
                            <p className="text-xs font-bold text-white mb-1">How to submit a request:</p>
                            <p className="text-xs text-slate-400">
                                Email <span className="text-emerald-400">info@1st-hub.com</span> with the subject <strong>"Data Deletion Request"</strong>. Please include your phone number for verification.
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                We process valid requests within <strong>30 days</strong>.
                            </p>
                        </div>
                    </div>
                </section>

               {/* 6. Security (SIMPLIFIED) */}
                <section className="mt-6">
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">6. Security</h3>
                    <p className="mb-2">We use industry-standard security measures to keep your data safe.</p>
                    <ul className="list-disc pl-5 space-y-2 text-slate-400">
                        <li>
                            <strong className="text-white">Secure Transmission:</strong> We use SSL/TLS encryption to protect your data whenever it is sent over the internet. This ensures that your orders and personal details cannot be intercepted or read while being transmitted.
                        </li>
                        <li>
                            <strong className="text-white">Secure Storage:</strong> Your data is stored securely on Amazon Web Services (AWS) servers. We use encryption to ensure that your stored information remains private and unreadable to unauthorized parties.
                        </li>
                        <li>
                            <strong className="text-white">Access Control:</strong> We strictly limit who can access your data. Only the specific systems and authorized personnel necessary to process your orders are granted access to your personal details.
                        </li>
                    </ul>
                </section>

                {/* 9. Contact */}
                <section className="mt-6">
                    <div className="text-slate-400 text-xs space-y-1">
    <p>Email: <a href="mailto:info@1st-hub.com" className="text-sky-400 hover:underline">info@1st-hub.com</a></p>
    <p>Phone: <a href="tel:+97333787388" className="text-sky-400 hover:underline">+973 33787388</a></p>
    <p>Website: <a href="https://1st-hub.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">https://1st-hub.com</a></p>
    <p>Address: Manama, Bahrain</p>
</div>
                </section>
            </div>
            
            <div className="text-center pt-6 pb-4">
                <p className="text-xs text-slate-500">© 2026 1st-Hub. All rights reserved.</p>
            </div>
        </div>

        {/* 5. Fixed Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end shrink-0">
            <button 
                onClick={onClose}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold text-xs transition-all shadow-lg active:scale-95"
            >
                CLOSE
            </button>
        </div>
      </div>
    </div>
  );
};