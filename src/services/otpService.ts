import client from "../configs/twilio";

const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

if (!serviceSid) {
  throw new Error("TWILIO_VERIFY_SERVICE_SID is not configured");
}

// Send OTP
export const sendOTP = async (phone: string) => {
  return client.verify.v2.services(serviceSid)
    .verifications.create({
      to: phone,
      channel: "sms",
    });
};

// Verify OTP
export const verifyOTP = async (phone: string, code: string) => {
  return client.verify.v2.services(serviceSid)
    .verificationChecks.create({
      to: phone,
      code: code,
    });
};
