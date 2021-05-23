import Koa from 'koa';
import session from 'koa-session';

export const PORT = 8000;
export const TASKS_DB_FILENAME = 'tasks.db';
export const USERS_DB_FILENAME = 'users.db';
export const TASKS_API_PREFIX = '/tasks';

export const SESSION_CONFIG = (app: Koa): Partial<session.opts> => ({
  key: 'koa.sess', // default koa.sess
  maxAge: 253402300000000, // 10000 years, default 1 day
  rolling: false, // (default false) Force a session identifier cookie to be set on every response.
  renew: true, // (default false) renew session when session is nearly expired
  sameSite: 'strict', // default none
  overwrite: true,
  // httpOnly: true, // default true
  secure: app.env !== 'development', // only send cookies over https. will error if no https
});
