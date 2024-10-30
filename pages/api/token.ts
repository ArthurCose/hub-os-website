import { NextApiRequest, NextApiResponse } from "next";
import { setCookie } from "cookies-next";
import { fetchDiscordUser } from "@/types/discord";
import db from "@/storage/db";
import { normalizeUsername } from "@/types/account";
import { signJwt } from "@/types/jwt";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method != "POST") {
    res.status(400).send({});
    return;
  }

  const discordToken = req.body?.token;
  const discordUser = await fetchDiscordUser(discordToken);

  let account = await db.findAccountByDiscordId(discordUser.id);

  if (!account) {
    const username = discordUser.username + "@discord";

    // create an account
    account = {
      username,
      normalized_username: normalizeUsername(username),
      discord_id: discordUser.id,
      avatar:
        discordUser.avatar != undefined
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}?size=128`
          : `/default-avatar.png`,
    };
    account.id = await db.createAccount(account);
  }

  const token = await signJwt({ user_id: db.idToString(account.id) });

  setCookie("token", token, {
    req,
    res,
    maxAge: 60 * 60 * 24 * 14,
    httpOnly: true,
  });

  res.status(200).send(undefined);
}
