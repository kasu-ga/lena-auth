# Lena Auth

> Implement a user authentication system in minutes.

Lena offers a simple and minimalist user authentication layer, just enough for quick and easy authentication, helping the developer spend less time on configuration and deployment.

Lena has no dependencies! So its use will not be limited to any site and can even be used on the web, such as Remix or Next.js. Furthermore, it is agnostic to the database you use, Lena adapts to your use and needs.

## Features

- Email authentication: Send a verification code to the user and use this to later obtain the user's session.
- OAuth Provider: Uses authentication from an OAuth provider and generates the user session.
- No password: You don't need to store user passwords. There will be no need to store passwords.

## Installation

```bash
npm install lena-auth
```

## Quick Start

### Create client

```ts
import { Lena } from "lena-auth";

const client = new Lena({
  expiresIn: 1000 * 60 * 60, // 1h (optional)
  mailer: async (options: MailerOptions) => {
    await mailer(options); // Logic to send emails e.g. nodemailer
  },
  database: {
    findUserBy: async (data: { where: Partial<User> }) => {
      return await db.users.find({ ...data.where }); // User[]
    },
    createUser: async (data: { user: { email: string; provider: string } }) => {
      return await db.users.create(data.user);
    },
    findSessionBy: async (data: { where: Partial<Session> }) => {
      return await db.session.findOne({ ...data.where }); // Session[]
    },
    createSession: async (data: { session: Omit<Session, "id"> }) => {
      return await db.session.create(data.session);
    },
    deleteSession: async (data: { id: Id }) => {
      await db.session.delete(data.id);
    },
    findCodeBy: async (data: { where: Partial<Code> }) => {
      return await db.code.findOne({ ...data.where }); // Code[]
    },
    createCode: async (data: { code: Omit<Code, "id"> }) => {
      return await db.code.create(data.code);
    },
    deleteCode: async (data: { id: Id }) => {
      await db.code.delete(data.id);
    },
  },
});
```

### Authenticate

#### With Email

Sends the user a verification code.

> Code options are those that the developer defines in his code model, if there are none, an empty object is passed.

```ts
await client.auth.create(
  { email },
  {
    /* session options */
  }
);
```

Verify the user code.

```ts
const result = await client.auth.verify(
  { email, code },
  {
    /* session options */
  }
);
```

### With Provider

```ts
const github = client.createProvider((client) => {
  return async (code: { code: string }) => {
    const githubToken = await axios("GITHUB_API_GET_TOKEN", { code }); // example
    const githubUser = await axios("GITHUB_API_USER_DETAILS", { token }); // example
    const user = await db.users.findOneOrcreate({
      email: githubUser.email,
      provider: "github",
    });
    return user;
  };
});
```

## License

[MIT License](https://github.com/kasu-ga/lena-auth/blob/main/LICENSE.md)
