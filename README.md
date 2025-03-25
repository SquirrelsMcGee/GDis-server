# GDis-Server

My personal custom Discord bot featuring local AI LLM integrations with web search.

No releases nor instructions are provided. Please do not use without attributing.

_p.s. This is for fun, for me, and I don't care._

_p.p.s The Dis is GDis stands for my screen-name, dispris, actually_

## Setup

These steps assume you have some node/web development knowledge.
Please search online for help if you get stuck, raise an issue if you really need it.

1. Ensure you have node installed (I'm using 20.14.0)
2. Run `npm install` in the project folder
3. Edit the `.env` file in the project folder to include your discord bot token, and brave api key (if using web-search integration).

## Development builds

This part assumes you want to write code and have changes happen immediately

1. Run `npm run dev`, this will automatically build the project, and then start the script in the `dist/` output folder

## External Runtime Dependencies

The following need to be installed and running in the background for all GDis functionality to work
- [GDis-piper-tts](https://github.com/SquirrelsMcGee/GDis-piper-tts) - For generating text-to-speech
- [GDis-transcribe](https://github.com/SquirrelsMcGee/GDis-transcribe) - For generating speech transcriptions
- [Ollama](https://ollama.com/) for locally hosted LLM model
