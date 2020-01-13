// Dependencies
import { prop, getModelForClass } from '@typegoose/typegoose'

export class User {
  @prop({ required: true, index: true, unique: true })
  id: number

  @prop({ default: false, required: true })
  sendoutDisabled: boolean
}

// Get User model
export const UserModel = getModelForClass(User, {
  schemaOptions: { timestamps: true },
})

// Get or create chat
export async function findUser(id: number) {
  let User = await UserModel.findOne({ id })
  if (!User) {
    try {
      User = await new UserModel({ id }).save()
    } catch (err) {
      User = await UserModel.findOne({ id })
    }
  }
  return User
}
