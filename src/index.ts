export interface LenaUserBase<Id> {
  id: Id;
  provider: string;
  email: string;
}

export interface LenaSessionBase<Id, User extends LenaUserBase<Id>> {
  id: Id;
  expiresOn: number;
  user: User;
}

export interface LenaCodeBase<Id> {
  id: Id;
  expiresOn: number;
  userId: Id;
  value: string;
}

export interface LenaDatabase<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>,
  Code extends LenaCodeBase<Id>
> {
  findUserBy: (data: { where: Partial<User> }) => Promise<User[]>;
  createUser: (data: {
    user: { email: string; provider: string };
  }) => Promise<User>;
  findSessionBy: (data: { where: Partial<Session> }) => Promise<Session[]>;
  createSession: (data: { session: Omit<Session, "id"> }) => Promise<Session>;
  deleteSession: (data: { id: Id }) => Promise<void>;
  findCodeBy: (data: { where: Partial<Code> }) => Promise<Code[]>;
  createCode: (data: { code: Omit<Code, "id"> }) => Promise<Code>;
  deleteCode: (data: { id: Id }) => Promise<void>;
}

export interface LenaMailerOptions<Id, User extends LenaUserBase<Id>> {
  user: User;
  code: string;
}

export interface LenaOptions<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>,
  Code extends LenaCodeBase<Id>
> {
  database: LenaDatabase<Id, User, Session, Code>;
  mailer: (options: LenaMailerOptions<Id, User>) => Promise<void>;
  expiresIn?: number;
}

export interface LenaSessionOptions {
  expiresIn: number;
}

export class LenaSession<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>,
  Code extends LenaCodeBase<Id>
> {
  readonly options: LenaSessionOptions;
  readonly db: LenaDatabase<Id, User, Session, Code>;

  constructor(
    db: LenaDatabase<Id, User, Session, Code>,
    options: LenaSessionOptions
  ) {
    this.db = db;
    this.options = options;
  }

  async create(data: Omit<Omit<Session, "id">, "expiresOn">) {
    return await this.db.createSession({
      session: {
        ...data,
        expiresOn: Date.now() + this.options.expiresIn,
      } as Session,
    });
  }

  async validate(data: { id: Id }) {
    const sessions = await this.db.findSessionBy({
      where: data as Partial<Session>,
    });
    const session = sessions[0];
    if (sessions.length === 0 || !session.id) return null;
    if (session.expiresOn < this.options.expiresIn) {
      await this.db.deleteSession(data);
      return null;
    }
    return session;
  }
}

export type LenaSessionExtraDetails<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>
> = Omit<Omit<Omit<Session, "id">, "user">, "expiresOn">;

export type LenaCodeExtraDetails<Id, Code extends LenaCodeBase<Id>> = Omit<
  Omit<Omit<Omit<Code, "id">, "userId">, "value">,
  "expiresOn"
>;

export interface LenaAuthOptions<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>,
  Code extends LenaCodeBase<Id>
> {
  mailer: (options: LenaMailerOptions<Id, User>) => Promise<void>;
  session: LenaSession<Id, User, Session, Code>;
}

export class LenaAuth<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>,
  Code extends LenaCodeBase<Id>
> {
  readonly options: LenaAuthOptions<Id, User, Session, Code>;
  readonly db: LenaDatabase<Id, User, Session, Code>;

  constructor(
    db: LenaDatabase<Id, User, Session, Code>,
    options: LenaAuthOptions<Id, User, Session, Code>
  ) {
    this.db = db;
    this.options = options;
  }

  async generateCode() {
    const code = Math.floor(100000 + Math.random() * 900000);
    return code.toString();
  }

  async signin(
    data: { email: string },
    extraCodeDetails: LenaCodeExtraDetails<Id, Code>
  ): Promise<void> {
    const users = await this.db.findUserBy({
      where: { email: data.email.toLowerCase().trim() } as Partial<User>,
    });
    let user = users[0];
    if (users.length === 0 || !user.id) {
      user = await this.db.createUser({
        user: { email: data.email, provider: "standalone" },
      });
    }
    const newCodeValue = await this.generateCode();
    await this.db.createCode({
      code: {
        ...extraCodeDetails,
        userId: user.id,
        expiresOn: Date.now() + 1000 * 60 * 10, // 10 minutes
        value: newCodeValue,
      } as any,
    });
    await this.options.mailer({
      user,
      code: newCodeValue,
    });
  }

  async verify(
    data: { email: string; code: string },
    extraSessionDetails: LenaSessionExtraDetails<Id, User, Session>
  ) {
    data.email = data.email.toLowerCase().trim();
    const users = await this.db.findUserBy({
      where: {
        email: data.email,
      } as Partial<User>,
    });
    if (users.length === 0 || !users[0]) return null;
    const codes = await this.db.findCodeBy({
      where: {
        userId: users[0].id,
      } as Partial<Code>,
    });
    if (codes.length === 0) return null;
    for (const code of codes) {
      if (code.expiresOn < Date.now()) {
        await this.db.deleteCode({ id: code.id });
      }
      const match = code.value === data.code;
      if (match) {
        await this.db.deleteCode({ id: code.id });
        const session = await this.options.session.create({
          ...extraSessionDetails,
          user: users[0],
        } as any);
        return { session };
      }
    }

    return null;
  }
}

export class LenaProvider<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>,
  Code extends LenaCodeBase<Id>,
  Input
> {
  private client: Lena<Id, User, Session, Code>;
  private fn: (input: Input) => Promise<User>;

  constructor(
    client: Lena<Id, User, Session, Code>,
    fn: (
      client: Lena<Id, User, Session, Code>
    ) => (input: Input) => Promise<User>
  ) {
    this.client = client;
    this.fn = fn(client);
  }

  async create(
    input: Input,
    extraSessionDetails: LenaSessionExtraDetails<Id, User, Session>
  ) {
    const user = await this.fn(input);
    const session = await this.client.session.create({
      ...extraSessionDetails,
      user,
    } as any);
    return session;
  }
}

export class Lena<
  Id,
  User extends LenaUserBase<Id>,
  Session extends LenaSessionBase<Id, User>,
  Code extends LenaCodeBase<Id>
> {
  readonly options: LenaOptions<Id, User, Session, Code>;
  readonly auth: LenaAuth<Id, User, Session, Code>;
  readonly session: LenaSession<Id, User, Session, Code>;

  constructor(options: LenaOptions<Id, User, Session, Code>) {
    this.options = options;
    this.session = new LenaSession(options.database, {
      expiresIn: options.expiresIn ?? 1000 * 60 * 60, // 1h,
    });
    this.auth = new LenaAuth(options.database, {
      mailer: options.mailer,
      session: this.session,
    });
  }

  createProvider<Input>(
    fn: (
      client: Lena<Id, User, Session, Code>
    ) => (input: Input) => Promise<User>
  ) {
    return new LenaProvider(this, fn);
  }
}
