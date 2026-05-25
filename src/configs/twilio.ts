import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID?.trim(),
  process.env.TWILIO_AUTH_TOKEN?.trim()
);

export default client;
