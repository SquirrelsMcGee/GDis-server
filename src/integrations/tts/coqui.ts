import { writeFileSync } from "fs";
import { catchError, lastValueFrom } from "rxjs";
import { TTS_FILEPATH } from "../..";
import { FatalException } from "../../lib/custom-error";
import { HttpService } from "../http";
import { ITextToSpeechProvider } from "./tts-provider";

export class CoquiTTS implements ITextToSpeechProvider {
  private readonly http = new HttpService('http://localhost', '5002');

  constructor() {
    this.pingServer().pipe(catchError(_ => {
      throw new FatalException('Coqui server is unavailable');
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
      console.error('why is this erroring', error);
      return Promise.reject();
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