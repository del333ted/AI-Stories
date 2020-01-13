import got from 'got'
import { Telegraf, ContextMessageUpdate, Markup as m, Extra } from 'telegraf'
import { attachUser } from './helpers/attachUser'
import { RequestModel, findRequest } from './models/Request'
import { ChatModel } from './models/Chat'
import { UserModel } from './models/User'
import * as rateLimit from 'telegraf-ratelimit'
import {
  dailyConfig,
  fixAggregation,
  statisticChart,
} from './helpers/statistic'
import { unsubCommand, sendoutCommand } from './helpers/sendOut'

const extend = got.extend({
  responseType: 'json',
  timeout: 10000,
  throwHttpErrors: false,
  headers: {
    'User-Agent': 'telegram-bot @AIStoriesBot',
  },
})

async function requestAndAnswer(
  ctx: ContextMessageUpdate,
  text: String,
  type: String,
) {
  ctx.replyWithChatAction('typing')
  let result: any

  switch (type) {
    case 'medium':
      result = (await extend.post('https://models.dobro.ai/gpt2/medium/', {
        json: {
          prompt: text,
          length: 60,
          num_samples: 1,
        },
      })) as any
      break
    case 'poem':
      result = (await extend.post('https://models.dobro.ai/gpt2_poetry/', {
        json: {
          prompt: text,
          length: 100,
        },
      })) as any
      if (
        result.body &&
        result.body.replies &&
        result.body.replies.length > 0
      ) {
        const finalResult = `<i>${text}</i>${result.body.replies[0]}`
        ctx.replyWithHTML(finalResult, {
          reply_to_message_id: ctx.message.message_id,
        })
        return await findRequest(ctx.message.message_id)
      }
      return
      break
    default:
      result = (await extend.post('https://models.dobro.ai/gpt2/medium/', {
        json: {
          prompt: text,
          length: 60,
          num_samples: 1,
        },
      })) as any
  }

  if (result.body && result.body.replies && result.body.replies.length > 0) {
    const finalResult = `<i>${text}</i>${result.body.replies[0]}`
    ctx.replyWithHTML(finalResult, {
      reply_to_message_id: ctx.message.message_id,
    })
    return await findRequest(ctx.message.message_id)
  }
}

export function setupBot(bot: Telegraf<ContextMessageUpdate>) {
  bot.use(
    rateLimit({
      window: 8000,
      limit: 1,
      onLimitExceeded: (ctx, next) =>
        ctx.reply('Я не могу так часто отвечать тебе. Пиши, пожалуйста, реже.'),
    }),
  )

  bot.use(attachUser)

  bot.start(async (ctx, next) => {
    ctx.replyWithHTML(
      `Привет, ${ctx.from.first_name}, я дополню твою историю с помощью магии нейросетей. Нужно лишь написать её начало из нескольких предложений. Чем четче будет сформулировано начало, тем лучше будет результат.\n\n/story <i>текст (опционально)</i> — команда для использования бота в чате или в реплае на сообщение для продолжения истории.\n/stih <i>текст (опционально)</i> — команда для создания стихотворений.\n/stats — статистика.\n\n<b>GitHub бота:</b> github.com/del333ted/AI-Stories\n\nБот это лишь "обертка" для взаимодействия с API. Авторство принадлежит оригинальному автору проекта и все благодарности необходимо отправлять ему.\n\nGitHub проекта: github.com/mgrankin/ru_transformers\nВеб-версия проекта: text.skynet.center\n\n<b>Автор бота:</b> @del333ted`,
    )
  })

  bot.command('help', async (ctx, next) => {
    ctx.replyWithHTML(
      `Привет, ${ctx.from.first_name}, я дополню твою историю с помощью магии нейросетей. Нужно лишь написать её начало из нескольких предложений. Чем четче будет сформулировано начало, тем лучше будет результат.\n\n/story <i>текст (опционально)</i> — команда для использования бота в чате или в реплае на сообщение для продолжения истории.\n/stih <i>текст (опционально)</i> — команда для создания стихотворений.\n/stats — статистика.\n\n<b>GitHub бота:</b> github.com/del333ted/AI-Stories\n\nБот это лишь "обертка" для взаимодействия с API. Авторство принадлежит оригинальному автору проекта и все благодарности необходимо отправлять ему.\n\nGitHub проекта: github.com/mgrankin/ru_transformers\nВеб-версия проекта: text.skynet.center\n\n<b>Автор бота:</b> @del333ted`,
    )
  })

  bot.command('unsub', unsubCommand)
  bot.command('sendout', sendoutCommand)

  bot.command('stats', async ctx => {
    // Chats count
    const Chats = await ChatModel.find().count()
    const ChatsArray = await ChatModel.aggregate(dailyConfig())
    const ChatsDaily = fixAggregation(
      ChatsArray.sort((a, b) => (a?._id > b?._id ? 1 : -1)),
    )
    const ChatsChart = statisticChart(ChatsDaily)
    // Requests count
    const Requests = await RequestModel.find().count()
    const RequestsArray = await RequestModel.aggregate(dailyConfig())
    const RequestsDaily = fixAggregation(
      RequestsArray.sort((a, b) => (a._id > b._id ? 1 : -1)),
    )
    const RequestsChart = statisticChart(RequestsDaily)
    // Users Count
    const Users = await UserModel.find().count()
    const UsersArray = await UserModel.aggregate(dailyConfig())
    const UsersDaily = fixAggregation(
      UsersArray.sort((a, b) => (a._id > b._id ? 1 : -1)),
    )
    const UsersChart = statisticChart(UsersDaily)
    ctx.replyWithHTML(
      `<b>Статистика:</b>\n\nПользователей: ${Users}\n${UsersChart}\n\nЧатов: ${Chats}\n${ChatsChart}\n\nЗапросов: ${Requests}\n${RequestsChart}`,
    )
  })

  bot.on(
    'inline_query',
    async ({ message, inlineQuery, answerInlineQuery }) => {
      if (inlineQuery.query) {
        const text = inlineQuery.query
        const mediumResult = (await extend.post(
          'https://models.dobro.ai/gpt2/medium/',
          {
            json: {
              prompt: text,
              length: 60,
              num_samples: 1,
            },
          },
        )) as any

        if (
          mediumResult.body &&
          mediumResult.body.replies &&
          mediumResult.body.replies.length > 0
        ) {
          const result = `<i>${text}</i>${mediumResult.body.replies[0]}`
          await answerInlineQuery(
            [
              {
                type: 'article',
                id: new Date().getTime().toString(),
                title: 'Story',
                description: `${text}${mediumResult.body.replies[0]}`,
                input_message_content: {
                  message_text: result,
                  parse_mode: 'HTML',
                },
              },
            ],
            { is_personal: true, cache_time: 0 },
          )
          return await findRequest(message.message_id)
        }
      }
    },
  )

  bot.command('story', async ctx => {
    let text = ctx.message.text.substr(7)
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text)
      text = ctx.message.reply_to_message.text
    if (text) {
      requestAndAnswer(ctx, text, 'medium')
    }
  })

  bot.hears(/\/story@AiStoriesBot/gm, async ctx => {
    let text = ctx.message.text.substr(20)
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text)
      text = ctx.message.reply_to_message.text
    if (text) {
      requestAndAnswer(ctx, text, 'medium')
    }
  })

  bot.command('stih', async ctx => {
    let text = ctx.message.text.substr(5)
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
      text = ctx.message.reply_to_message.text
    }
    if (text) {
      requestAndAnswer(ctx, text, 'poem')
    }
  })

  bot.hears(/\/stih@AiStoriesBot/gm, async ctx => {
    let text = ctx.message.text.substr(19)
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
      text = ctx.message.reply_to_message.text
    }
    if (text) {
      requestAndAnswer(ctx, text, 'poem')
    }
  })

  bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type !== 'private') {
      return
    }
    if (ctx.message.text) {
      const text = ctx.message.text
      if (text) {
        requestAndAnswer(ctx, text, 'medium')
      }
    }
  })

  bot.on('chosen_inline_result', ({ chosenInlineResult }) => {
    console.log('chosen inline result', chosenInlineResult)
  })

  bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
  })

  return bot
}
