import { getTwilioClient } from "../configs/twilio";

const getVerifyServiceSid = () => {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!serviceSid) {
    throw new Error("TWILIO_VERIFY_SERVICE_SID is not configured");
  }

  return serviceSid;
};

// Send OTP
export const sendOTP = async (phone: string) => {
  return getTwilioClient().verify.v2.services(getVerifyServiceSid())
    .verifications.create({
      to: phone,
      channel: "sms",
    });
};

// Verify OTP
export const verifyOTP = async (phone: string, code: string) => {
  return getTwilioClient().verify.v2.services(getVerifyServiceSid())
    .verificationChecks.create({
      to: phone,
      code: code,
    });
};
