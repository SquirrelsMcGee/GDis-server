import { createReadStream, statSync } from "fs";
import path from "path";
import { lastValueFrom, map, of } from "rxjs";
import { ENV_CONFIG } from "../../config";
import { HttpService } from "../http";
import { ISpeechToTextProvider } from "./stt-provider";

/**
 * This currently relies on a custom Whisper Api developed by me (Not available publically yet)
 * The api has 1 endpoint POST/transcribe
 *  - this accepts FormData with 1 key, 'file'
 */
export class WhisperTranscription implements ISpeechToTextProvider {
  private readonly httpService: HttpService;

  constructor(private readonly audioFolder: string) {
    this.httpService = new HttpService(ENV_CONFIG.TRANSCRIPTION_SERVER_URL, ENV_CONFIG.TRANSCRIPTION_SERVER_PORT);

  }

  generateTranscript(filename: string): Promise<string> {
    return lastValueFrom(this.sendRequest(filename));
  }

  private sendRequest(filename: string) {
    const filePath = path.resolve(this.audioFolder, filename);
    const stats = statSync(filePath)
    if (stats.size / 1024 < 300) // Arbitrary minimum filesize
      return of('')

    const formData = new FormData();
    const file = createReadStream(filePath);
    formData.append('file', file, filename);

    return this.httpService.post<{ transcription: string }>('transcribe', formData)
      .pipe(map(data => data.transcription));
  }
}
