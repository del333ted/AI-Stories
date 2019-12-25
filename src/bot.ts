import got from 'got'
import { Telegraf, ContextMessageUpdate, Markup as m, Extra } from 'telegraf'
import { attachUser } from './helpers/attachUser'
import { RequestModel, findRequest } from './models/Request'
import { ChatModel } from './models/Chat'
import { UserModel } from './models/User'
import * as rateLimit from 'telegraf-ratelimit'

const extend = got.extend({
  responseType: 'json',
  timeout: 10000,
  throwHttpErrors: false,
  headers: {
    'User-Agent': 'telegram-bot @AIStoriesBot'
  }
})

async function requestAndAnswer(ctx: ContextMessageUpdate, text: String) {
  ctx.replyWithChatAction('typing')

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
    ctx.replyWithHTML(result, {
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
      onLimitExceeded: (ctx, next) => ctx.reply('Я не могу так часто отвечать тебе. Пиши, пожалуйста, реже.'),
    }),
  )

  bot.use(attachUser)

  bot.start(async (ctx, next) => {
    ctx.replyWithHTML(
      `Привет, ${ctx.from.first_name}, я дополню твою историю с помощью магии нейросетей. Нужно лишь написать её начало из нескольких предложений. Чем четче будет сформулировано начало, тем лучше будет результат.\n\n/story <i>текст (опционально)</i> — команда для использования бота в чате или в реплае на сообщение для продолжения истории.\n\n<b>GitHub бота:</b> github.com/del333ted/AI-Stories\n\nБот это лишь "обертка" для взаимодействия с API. Авторство принадлежит оригинальному автору проекта и все благодарности необходимо отправлять ему.\n\nGitHub проекта: github.com/mgrankin/ru_transformers\nВеб-версия проекта: text.skynet.center\n\n<b>Автор бота:</b> @del333ted`,
    )
  })

  bot.command('help', async (ctx, next) => {
    ctx.replyWithHTML(
      `Привет, ${ctx.from.first_name}, я дополню твою историю с помощью магии нейросетей. Нужно лишь написать её начало из нескольких предложений. Чем четче будет сформулировано начало, тем лучше будет результат.\n\n/story <i>текст (опционально)</i> — команда для использования бота в чате или в реплае на сообщение для продолжения истории.\n\n<b>GitHub бота:</b> github.com/del333ted/AI-Stories\n\nБот это лишь "обертка" для взаимодействия с API. Авторство принадлежит оригинальному автору проекта и все благодарности необходимо отправлять ему.\n\nGitHub проекта: github.com/mgrankin/ru_transformers\nВеб-версия проекта: text.skynet.center\n\n<b>Автор бота:</b> @del333ted`,
    )
  })

  bot.command('stats', async ctx => {
    if (ctx.from.id === Number(process.env.OWNER_ID)) {
      // Chats count
      const Chats = await ChatModel.find().count()
      // Requests count
      const Requests = await RequestModel.find().count()
      // Users Count
      const Users = await UserModel.find().count()
      ctx.replyWithHTML(
        `<b>Статистика:</b>\n\nПользователей: ${Users}\n\nЧатов: ${Chats}\n\nЗапросов: ${Requests}`,
      )
    }
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
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) text = ctx.message.reply_to_message.text
    if (text) {
      requestAndAnswer(ctx, text)
    }
  })

  bot.hears(/\/story@AiStoriesBot/gm, async ctx => {
    let text = ctx.message.text.substr(20)
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) text = ctx.message.reply_to_message.text
    if (text) {
      requestAndAnswer(ctx, text)
    }
  })

  bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type !== 'private') {
      return
    }
    if (ctx.message.text) {
      const text = ctx.message.text
      if (text) {
        requestAndAnswer(ctx, text)
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
