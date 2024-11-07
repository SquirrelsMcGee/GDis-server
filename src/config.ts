import dotenv from "dotenv";

dotenv.config();

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  throw new Error("Missing environment variables");
}

export const config = {
  DISCORD_TOKEN
};

