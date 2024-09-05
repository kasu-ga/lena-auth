import {
  Lena,
  LenaUserBase,
  LenaSessionBase,
  LenaCodeBase,
} from "../../src/index";

let userCode: string;

interface User extends LenaUserBase<number> {}

interface Session extends LenaSessionBase<number, User> {}

interface Code extends LenaCodeBase<number> {}

const users: User[] = [];
const sessions: Session[] = [];
const codes: Code[] = [];

const client = new Lena<number, User, Session, Code>({
  mailer: async (options) => {
    userCode = options.code;
  },
  database: {
    findUserBy: async ({ where }) => {
      return users.filter((user) => user.email === where.email) ?? [];
    },
    createUser: async ({ user }) => {
      const lastUser = users[users.length - 1];
      const newUser = {
        id: lastUser ? lastUser.id + 1 : 0,
        ...user,
      };
      users.push(newUser);
      return newUser;
    },
    findSessionBy: async ({ where }) => {
      return sessions.filter((session) => session.id === where.id) ?? [];
    },
    createSession: async ({ session }) => {
      const lastSession = sessions[sessions.length - 1];
      const newSession = {
        id: lastSession ? 0 : lastSession + 1,
        ...session,
      };
      sessions.push(newSession);
      return newSession;
    },
    deleteSession: async ({ id }) => {
      const index = sessions.findIndex((session) => session.id === id);
      if (index !== -1) sessions.splice(index, 1);
    },
    findCodeBy: async ({ where }) => {
      return (
        codes.filter(
          (code) => code.id === where.id || code.userId === where.userId
        ) ?? []
      );
    },
    createCode: async ({ code }) => {
      const lastCode = codes[codes.length - 1];
      const newCode = {
        id: lastCode ? 0 : lastCode + 1,
        ...code,
      };
      codes.push(newCode);
      return newCode;
    },
    deleteCode: async ({ id }) => {
      const index = codes.findIndex((code) => code.id === id);
      if (index !== -1) codes.splice(index, 1);
    },
  },
});

const provider = client.createProvider((client) => {
  return async (input: {}) => {
    const newUser = client.options.database.createUser({
      user: {
        email: "user@mail.com",
        provider: "provider",
      },
    });
    return newUser;
  };
});

export { client, userCode, users, sessions, provider };
