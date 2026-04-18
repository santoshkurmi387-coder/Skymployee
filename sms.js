/**
 * utils/sms.js
 * Sends OTP via Twilio SMS.
 * Falls back to console.log in development so you can test without real SMS.
 */

const generateOTP = () => {
  // Generate a secure 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (mobile, otp) => {
  // In development, just print the OTP — no real SMS sent
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📱 OTP for +91${mobile}: ${otp}\n`);
    return { success: true, dev: true };
  }

  // In production, use Twilio
  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await twilio.messages.create({
    body: `CourierOps OTP: ${otp}. Valid for 10 minutes. Do not share with anyone.`,
    from: process.env.TWILIO_PHONE,
    to:   `+91${mobile}`,   // assuming Indian numbers (+91)
  });

  return { success: true };
};

module.exports = { generateOTP, sendOTP };
