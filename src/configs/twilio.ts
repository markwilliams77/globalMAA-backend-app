import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

export const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured");
  }

  client = client ?? twilio(accountSid, authToken);

  return client;
};
