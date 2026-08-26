import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [message, setMessage] = useState('Preparing secure checkout...');
  const startedRef = useRef(false);
  const bookingDraft = location.state?.bookingDraft;

  useEffect(() => {
    if (!bookingDraft) {
      toast.error('Missing booking details. Please create booking again.');
      navigate('/dashboard', { replace: true });
      return;
    }

    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const startPayment = async () => {
      try {
        setMessage('Creating payment order...');
        const { data } = await axios.post(
          `${BACKEND_URL}/api/payments/create-order`,
          bookingDraft,
          { withCredentials: true }
        );

        await loadRazorpayScript();
        setMessage('Opening Razorpay checkout...');

        const razorpayKey = data.razorpay_key_id || process.env.REACT_APP_RAZORPAY_KEY_ID;
        if (!razorpayKey) {
          throw new Error('Razorpay key is missing');
        }

        const options = {
          key: razorpayKey,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'Smart Parking',
          description: `Parking booking for ${String(bookingDraft.vehicle_number || '').toUpperCase()}`,
          order_id: data.order_id,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
          },
          notes: {
            vehicle_type: bookingDraft.vehicle_type,
            duration_hours: String(bookingDraft.duration_hours),
          },
          theme: {
            color: '#18181b',
          },
          handler: async function (response) {
            try {
              setMessage('Verifying payment and creating booking...');
              await axios.post(
                `${BACKEND_URL}/api/payments/verify-and-book`,
                {
                  booking: bookingDraft,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
                { withCredentials: true }
              );
              toast.success('Booking created successfully');
              navigate('/dashboard', { replace: true });
            } catch (error) {
              toast.error(error.response?.data?.detail || 'Payment verification failed');
              navigate('/dashboard', { replace: true });
            }
          },
          modal: {
            ondismiss: () => {
              toast.error('Payment cancelled');
              navigate('/dashboard', { replace: true });
            },
          },
        };

        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.on('payment.failed', (response) => {
          const reason = response?.error?.description || 'Payment failed';
          toast.error(reason);
          navigate('/dashboard', { replace: true });
        });
        razorpayInstance.open();
      } catch (error) {
        toast.error(error.response?.data?.detail || error.message || 'Unable to start payment');
        navigate('/dashboard', { replace: true });
      }
    };

    startPayment();
  }, [bookingDraft, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6">
      <div className="bg-white border border-zinc-200 p-8 w-full max-w-md text-center">
        <div className="w-14 h-14 border-4 border-zinc-900 border-t-transparent animate-spin mx-auto mb-5" />
        <h1 className="text-xl font-semibold text-zinc-950 mb-2">Processing Payment</h1>
        <p className="text-zinc-600">{message}</p>
      </div>
    </div>
  );
}
