import dotenv from "dotenv";
import { FatalException } from "./lib/custom-error";
dotenv.config();

const {
  // Discord settings
  DISCORD_TOKEN,

  // Web search settings
  ENABLE_WEB_SEARCH,
  BRAVE_API_KEY,

  // Ollama settings
  ENABLE_OLLAMA_AI,
  OLLAMA_SERVER_URL,
  OLLAMA_SERVER_PORT,

  // Coqui settings
  ENABLE_COQUI_AI,
  COQUI_SERVER_URL,
  COQUI_SERVER_PORT
} = process.env;

if (DISCORD_TOKEN === 'PLACEHOLDER' || !DISCORD_TOKEN)
  throw new FatalException('Failed to start, Discord token unset');

export const ENV_CONFIG = {
  // Discord settings
  DISCORD_TOKEN,

  // Web search settings
  ENABLE_WEB_SEARCH: ENABLE_WEB_SEARCH === 'true', // Convert to bool from string
  BRAVE_API_KEY,

  // Ollama settings
  ENABLE_OLLAMA_AI: ENABLE_OLLAMA_AI === 'true', // Convert to bool from string
  OLLAMA_SERVER_URL,
  OLLAMA_SERVER_PORT,

  // Coqui settings
  ENABLE_COQUI_AI: ENABLE_COQUI_AI === 'true', // Convert to bool from string
  COQUI_SERVER_URL,
  COQUI_SERVER_PORT
};

