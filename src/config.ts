import dotenv from "dotenv";
import { FatalException } from "./lib/custom-error";
dotenv.config();

const {
  // Discord settings
  DISCORD_TOKEN,
  ENABLE_TTS,
  ENABLE_CHAT_HISTORY_SUMMARY,

  // Web search settings
  ENABLE_WEB_SEARCH,
  BRAVE_API_KEY,

  // Ollama settings
  ENABLE_OLLAMA_AI,
  OLLAMA_SERVER_URL,
  OLLAMA_SERVER_PORT, // Optional
  OLLAMA_MODEL_NAME,

  // Coqui settings
  ENABLE_COQUI_AI,
  COQUI_SERVER_URL,
  COQUI_SERVER_PORT,

  // Transcription settings
  ENABLE_TRANSCRIPTION,
  TRANSCRIPTION_SERVER_URL,
  TRANSCRIPTION_SERVER_PORT
} = process.env;

{
  // Assert required options
  let exceptionMessages = [];
  if (DISCORD_TOKEN === 'PLACEHOLDER' || !DISCORD_TOKEN)
    exceptionMessages.push('Discord token unset');

  if (ENABLE_OLLAMA_AI) {
    if (!OLLAMA_SERVER_URL)
      exceptionMessages.push('Ollama server URL not provided');

    if (!OLLAMA_MODEL_NAME)
      exceptionMessages.push('Ollama model name not provided');
  }

  if (ENABLE_COQUI_AI) {
    if (!COQUI_SERVER_URL)
      exceptionMessages.push('Coqui URL not provided');
  }

  if (exceptionMessages.length > 0)
    throw new FatalException('Failed to start ' + exceptionMessages.join(',\r\n    '));
}

/**
 * Application config
 */
export const ENV_CONFIG = {
  // Discord settings
  DISCORD_TOKEN,
  ENABLE_TTS: ENABLE_TTS === 'true',
  ENABLE_CHAT_HISTORY_SUMMARY: ENABLE_CHAT_HISTORY_SUMMARY === 'true',

  // Web search settings
  ENABLE_WEB_SEARCH: ENABLE_WEB_SEARCH === 'true',
  BRAVE_API_KEY,

  // Ollama settings
  ENABLE_OLLAMA_AI: ENABLE_OLLAMA_AI === 'true',
  OLLAMA_SERVER_URL: OLLAMA_SERVER_URL ?? 'http://localhost',
  OLLAMA_SERVER_PORT,
  OLLAMA_MODEL_NAME: OLLAMA_MODEL_NAME!,

  // Coqui settings
  ENABLE_COQUI_AI: ENABLE_COQUI_AI === 'true',
  COQUI_SERVER_URL: COQUI_SERVER_URL ?? 'http://localhost',
  COQUI_SERVER_PORT,

  ENABLE_TRANSCRIPTION,
  TRANSCRIPTION_SERVER_URL: TRANSCRIPTION_SERVER_URL ?? 'http://localhost',
  TRANSCRIPTION_SERVER_PORT
};

