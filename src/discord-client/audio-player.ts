import { AudioPlayer, AudioPlayerError, AudioPlayerStatus, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator, joinVoiceChannel, VoiceConnection } from "@discordjs/voice";
import { Guild, VoiceBasedChannel } from "discord.js";
import { buffer, filter, first, groupBy, map, merge, mergeMap, Observable, Subject, throttleTime, timer } from "rxjs";
import { Logger } from "../helpers/logger";
import { FatalException, NonFatalException } from "../lib/custom-error";
import { AudioSavedMetadata } from "./client-voice";

// Required to use node specific FormData instead of browser based
import { existsSync } from "node:fs";
import { DIR_NAME } from "..";
import { WhisperTranscription } from "../integrations/stt/whisper";
import { AudioRecorder } from "./client-voice-receiver";

export class AudioBufferedEvent {
  constructor(
    public readonly userId: string,
    public readonly events: AudioSavedMetadata[]
  ) { }
}

export class DiscordAudioPlayer {
  public readonly onAudioSaved: Observable<AudioBufferedEvent>;

  private connection?: VoiceConnection;
  private player?: AudioPlayer;
  private transcriber: WhisperTranscription;

  private readonly logger = new Logger();
  private readonly onAudioSavedSubject$: Subject<AudioSavedMetadata>;

  private readonly audioFolder = `${DIR_NAME}/tmp_saved`;

  private playbackQueue: string[];
  private isPlaying: boolean;

  private activeRecordings: Map<string, boolean>;

  constructor(private readonly name: string,
    guild: Guild,
    channel: VoiceBasedChannel
  ) {
    this.logger.setInfo(this.name);
    this.activeRecordings = new Map<string, boolean>();

    this.onAudioSavedSubject$ = new Subject<AudioSavedMetadata>();
    this.onAudioSaved = this.onAudioSavedSubject$.pipe(
      groupBy(event => event.userId),
      mergeMap(group$ => {
        return group$.pipe(
          //bufferWhen(() => timer(2000)), // Emit events that fall within the buffer time
          buffer(merge(timer(2000), group$.pipe(throttleTime(500)))),
          filter(bufferedEvents => bufferedEvents.length > 0), // Filter out empty buffers
          map(bufferedEvents => ({ userId: group$.key, events: bufferedEvents }))
        )
      })
    );

    this.playbackQueue = [];
    this.isPlaying = false;

    this.transcriber = new WhisperTranscription(this.audioFolder);

    this.player = createAudioPlayer();
    this.connection = this.connectToVoiceChannel(guild, channel);
    this.connection.subscribe(this.player);
    this.player.on('error', this.handleError.bind(this));
    this.player.on(AudioPlayerStatus.Idle, this.onIdle.bind(this));

    this.connection.receiver.speaking.on('start', (userId) => {
      if (userId !== '147399011567927296')
        return;

      // Prevent starting multiple recordings close together
      // Don't create a new recorder if one already exists, this prevents multiple recorders happening for stuttered speech
      if (this.activeRecordings.get(userId)) return;

      this.activeRecordings.set(userId, true);

      const recorder = new AudioRecorder(this.connection!, userId, this.audioFolder);
      recorder.onComplete.pipe(first()).subscribe(async (file) => {
        await this.transcribeAudio(userId, file);
        setTimeout(() => {
          this.activeRecordings.set(userId, false);
        }, 500); // Debounce time
      });
      recorder.startRecording();
    });
  }

  public enqueue(filePath: string) {
    this.playbackQueue.push(filePath);

    if (!this.isPlaying)
      this.playNext();
  }

  private playNext() {
    if (this.playbackQueue.length === 0) {
      this.isPlaying = false;
      this.logger.info('Playback queue is empty');
      return;
    }

    const filePath = this.playbackQueue.shift();
    if (!filePath)
      throw new FatalException('Playback queue returned undefined path');

    this.logger.info('Started playing audio');

    if (!this.player || !this.connection)
      throw new FatalException('Failed to create player or connection');

    // Create resource and play it
    const audio = createAudioResource(filePath);
    this.player.play(audio);
    this.isPlaying = true;
  }

  private handleError(error: AudioPlayerError) {
    this.logger.error('Error in voice player', error);
    this.connection?.destroy();
  }

  private onIdle() {
    this.logger.info('Finished playing audio');
    this.playNext();
  }


  private connectToVoiceChannel(guild: Guild, channel: VoiceBasedChannel) {
    if (!guild || !channel)
      throw new NonFatalException('Cannot connect to voice channel, Guild or Channel was null');

    return joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      selfDeaf: false
    });
  }

  private async transcribeAudio(userId: string, file: string) {
    this.logger.info('Getting transcription');
    if (!existsSync(file))
      return;

    const transcript = await this.transcriber.generateTranscript(file)

    // Delete any leftover files
    //if (file) void fs.unlink(file);

    if (transcript.length <= 0) {
      this.logger.warn('Transcription was of length 0, ignoring');
      return;
    }

    this.logger.info(`Transcription saved for userId={${userId}}, passing along`);
    this.onAudioSavedSubject$.next(new AudioSavedMetadata(userId, transcript));
  }
}
