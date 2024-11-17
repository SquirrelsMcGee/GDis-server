import dotenv from "dotenv";
import { FatalException } from "./lib/custom-error";
dotenv.config();

const { DISCORD_TOKEN, BRAVE_API_KEY, ENABLE_WEB_SEARCH } = process.env;

if (!DISCORD_TOKEN) {
  throw new FatalException('Missing environment variable: DISCORD_TOKEN');
}

export const ENV_CONFIG = {
  DISCORD_TOKEN,
  BRAVE_API_KEY,
  ENABLE_WEB_SEARCH: ENABLE_WEB_SEARCH === 'true'
};

