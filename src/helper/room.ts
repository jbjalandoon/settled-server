import { GameDetails, Games, GameStats } from '../types/room'

// TODO: maybe store this on database?
const typingPhrases = [
  `He pressed the button and stepped inside just as the doors closed. “Nice weather today,” someone muttered awkwardly. The ride felt longer than it was. Silence clung to the walls like static.`,
  `Vines dangled from tall trees, swaying with every gust of wind. Birds called out in a language only they understood. Every step forward brought a new sound, a new thrill. She clutched her map tighter, heart pounding with anticipation.`,
  `It opened with a loud snap, then instantly turned inside out. Wind roared through the street like a freight train. She laughed, soaked from head to toe. Sometimes, there's nothing to do but embrace the storm.`,
  `The sun streamed in, warm and heavy through the curtains. A quiet hum of life outside made the room feel even more still. He drifted into a nap without meaning to. Time seemed to melt away in the comfort of stillness.`,
  `She typed the words, stared at the screen, and then hit backspace. Again. Some things are easier to think than to say. Eventually, she closed the tab and let it go.`,
  `The train rattled along the tracks, steady and fast. Passengers stared out the windows, lost in their thoughts. Fields rolled by like paintings. The world looked peaceful from this side of the glass.`,
  `One wrong move, and the cup tipped over. The brown liquid spread like a slow-moving wave across the table. “No!” she shouted, lunging for a stack of napkins. Her notes were soaked, her day officially ruined—or maybe just off to a dramatic start.`,
  `Snowflakes floated gently, blanketing everything in white. The air smelled clean, like fresh linen and cold metal. Children shouted with excitement as they caught flakes on their tongues. The silence that followed was magical.`,
  `Old files, forgotten emails, and unsent drafts live in digital limbo. They're quiet reminders of tasks left unfinished and thoughts never shared. Sometimes, she scrolls through them like old photos. It feels like visiting a past version of herself.`,
  `He held the door open a little longer than needed. She smiled and said thank you, surprised by the small gesture. It cost him nothing, but changed her whole morning. Kindness doesn’t need to be loud to be powerful.`,
]

function getParagraph(): string[] {
  const randomIndex = Math.floor(Math.random() * typingPhrases.length)
  const paragraph = typingPhrases[randomIndex]
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')

  return paragraph.split(' ')
}

export const generateGames = (games: Games[], first: string) => {
  const gameStats: GameStats = {}
  const gameDetails: GameDetails = {}

  games.forEach((el) => {
    switch (el) {
      case 'typing': {
        // TODO: fix some special character (rare can't be typed)
        const paragraph: string[] = getParagraph()
        // const paragraph: string[] = ['the']
        gameStats[el] = {
          wpm: 0,
          mistakes: 0,
          current: paragraph[0],
          entry: [],
          right: paragraph.slice(1),
          timeFinished: null,
        }
        gameDetails[el] = {
          paragraph: paragraph.join(' '),
          timeLimit: 300,
          startTime: null,
          winner: null,
        }
        break
      }
      case 'memory': {
        gameStats[el] = {
          correctTiles: 0,
          timeFinished: null,
          level: 1,
        }
        gameDetails[el] = {
          sequence: Array.from({ length: 2 }, () =>
            Math.floor(Math.random() * 9)
          ),
          winner: null,
          startTime: null,
        }
        break
      }
      case 'connect': {
        const grid = new Array<(string | null)[]>(6).fill(
          new Array<string | null>(7).fill(null)
        )
        gameStats[el] = null
        gameDetails[el] = {
          grid,
          startTime: null,
          winner: null,
          turn: 0,
          currentPlayer: first,
        }
      }
    }
  })

  return { gameStats, gameDetails }
}
