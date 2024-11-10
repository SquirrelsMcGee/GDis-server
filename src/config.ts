import dotenv from "dotenv";

dotenv.config();

const { DISCORD_TOKEN, BRAVE_API_KEY } = process.env;

if (!DISCORD_TOKEN) {
  throw new Error('Missing environment variable: DISCORD_TOKEN');
}

export const config = {
  DISCORD_TOKEN,
  BRAVE_API_KEY
};

