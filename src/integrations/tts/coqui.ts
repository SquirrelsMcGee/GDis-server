import { writeFileSync } from "fs";
import { catchError, lastValueFrom } from "rxjs";
import { TTS_FILEPATH } from "../..";
import { ENV_CONFIG } from "../../config";
import { FatalException } from "../../lib/custom-error";
import { HttpService } from "../http";
import { ITextToSpeechProvider } from "./tts-provider";

export class CoquiTTS implements ITextToSpeechProvider {
  private readonly http = new HttpService(ENV_CONFIG.COQUI_SERVER_URL, ENV_CONFIG.COQUI_SERVER_PORT);

  constructor() {
    this.pingServer().pipe(catchError(_ => {
      throw new FatalException('TTS server is unavailable');
    })).subscribe();
  }

  public async generateSpeech(inputText: string): Promise<void> {
    try {
      const responseData = await lastValueFrom(this.sendRequest(inputText));

      if (!responseData)
        throw new FatalException('No data from TTS server');

      writeFileSync(TTS_FILEPATH, responseData);

      return Promise.resolve();
    }
    catch (error) {
      return Promise.reject(error);
    }
  }

  private sendRequest(inputText: string) {
    const formData = new FormData();
    formData.set('text', inputText);
    formData.set('speaker_id', 'p313');

    return this.http.post<any>('api/tts', formData, undefined, undefined, 'arraybuffer');
  }

  private pingServer() {
    return this.http.get<any>('');
  }
}