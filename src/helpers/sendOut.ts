import { UserModel, findUser, User } from '../models'
import { bot } from '../app'
import { ContextMessageUpdate } from 'telegraf'
import { DocumentType } from '@typegoose/typegoose'

async function sendOut(text: string) {
  try {
    const users = await UserModel.find()

    let n = 1
    let usersCount = 0
    for (const user of users) {
      if (!user.sendoutDisabled) {
        try {
          await bot.telegram.sendMessage(user.id, text, {
            parse_mode: 'HTML',
          })
          usersCount = usersCount + 1
        } catch (e) {}

        if (n > 19) {
          await sleep(1000)
          n = 0
        }
        n = n + 1
      }
    }
    return usersCount
  } catch (err) {
    bot.telegram.sendMessage(Number(process.env.OWNER_ID), err.toString())
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function sendoutCommand(ctx: ContextMessageUpdate) {
  if (ctx.message.from.id === Number(process.env.OWNER_ID)) {
    const text = ctx.message.text.substr(9)
    const answ = await sendOut(text)
    await ctx.reply(`Sendout done.
      
      Users: ${answ}`)
  }
}

export async function unsubCommand(ctx: ContextMessageUpdate) {
  const User = (await findUser(ctx.from.id)) as DocumentType<User>
  User.sendoutDisabled = true
  await User.save()

  await ctx.reply('Готово! Ты отписался от рассылки.')
}
