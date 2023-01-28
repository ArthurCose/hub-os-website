// default storage implementation for development

import { PackageMeta } from "@/types/package-meta";
import { Query, queryTest } from "@/types/query";
import { sortBy, SortMethod } from "@/types/sort-method";
import { DB as DB } from "./db";
import fs from "fs";
import { Account } from "@/types/account";

type Data = {
  packages: PackageMeta[];
  accounts: Account[];
  latest_account: number;
};

const databaseFilePath = "storage/_disk/data.json";

function loadData(): Data {
  try {
    // assuming the data is stored properly, if it isn't we can just delete the file
    const buffer = fs.readFileSync(databaseFilePath);
    const json = buffer.toString();
    const db = JSON.parse(json) as Data;

    return db;
  } catch {
    return {
      packages: [],
      accounts: [],
      latest_account: 0,
    };
  }
}

export default class Disk implements DB {
  data: Data;

  constructor() {
    this.data = loadData();
    fs.mkdirSync("storage/_disk/mods", { recursive: true });
  }

  async save() {
    fs.writeFile(databaseFilePath, JSON.stringify(this.data), () => {});
  }

  async createAccount(account: Account): Promise<unknown> {
    const newAccount = {
      ...account,
      id: this.data.latest_account,
    };

    this.data.latest_account++;

    this.data.accounts.push(newAccount);
    await this.save();

    return newAccount.id;
  }

  async findAccountByDiscordId(
    discordId: string
  ): Promise<Account | undefined> {
    return this.data.accounts.find(
      (account) => account.discord_id == discordId
    );
  }

  async upsertPackageMeta(meta: PackageMeta) {
    this.data.packages.push(meta);

    const existingMeta = this.data.packages.find(
      (storedMeta) => storedMeta.package.id == meta.package.id
    );

    if (existingMeta) {
      existingMeta.package = meta.package;
      existingMeta.dependencies = meta.dependencies;
      existingMeta.defines = meta.defines;
      existingMeta.updated_date = new Date();
    } else {
      meta.creation_date = new Date();
      meta.updated_date = new Date();
      this.data.packages.push(meta);
    }
    await this.save();
  }

  async findPackageMeta(id: string): Promise<PackageMeta | undefined> {
    return this.data.packages.find((meta) => meta.package.id == id);
  }

  async listPackages(
    query: Query,
    sortMethod: SortMethod,
    skip: number,
    count: number
  ): Promise<PackageMeta[]> {
    const packages = [];

    // innefficient, creates a new array
    const relevantPackages = this.data.packages.filter((meta) =>
      queryTest(query, meta)
    );

    sortBy(relevantPackages, sortMethod);

    for (let i = skip; i < relevantPackages.length && i < skip + count; i++) {
      packages.push(relevantPackages[i]);
    }

    return packages;
  }

  async uploadPackageZip(id: string, stream: NodeJS.ReadableStream) {
    const writeStream = fs.createWriteStream(`storage/_disk/mods/${id}.zip`);
    stream.pipe(writeStream);
  }

  async downloadPackageZip(
    id: string
  ): Promise<NodeJS.ReadableStream | undefined> {
    return fs.createReadStream(`storage/_disk/mods/${id}.zip`);
  }
}