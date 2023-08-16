import { NextApiRequest, NextApiResponse } from "next";
import { PackageMeta } from "@/types/package-meta";
import db from "@/storage/db";
import { Query } from "@/types/query";
import { SortMethod } from "@/types/sort-method";
import { getAccount } from "../users/me";
import { getCookie } from "cookies-next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method == "GET") {
    await handleGet(req, res);
  } else {
    res.status(400).send(undefined);
  }
}

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse<PackageMeta[] | undefined>
) {
  let skip = Math.floor(+((req.query.skip as string) || 0));

  if (skip < 0 || skip == Infinity) {
    skip = 0;
  }

  const query: Query = {
    hidden: false,
  };

  if (req.query.category) {
    query["package.category"] = req.query.category;
  }

  if (req.query.name) {
    query["$package.name"] = req.query.name;
  }

  if (typeof req.query.creator == "string") {
    const creatorId = db.stringToId(req.query.creator);
    query["creator"] = creatorId;

    if (req.query.hidden == "true") {
      const account = await getAccount(req, res);

      if (db.compareIds(creatorId, account?.id)) {
        query.hidden = true;
      } else {
        res.status(403).end();
        return;
      }
    }
  }

  const limit = Math.min(+((req.query.limit as string) || 0), 100);

  const list = await db.listPackages(
    query,
    SortMethod.CreationDate,
    skip,
    limit
  );

  res.status(200).send(list);
}
