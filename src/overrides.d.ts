import { Request } from 'koa';
import { Session } from 'koa-session';

declare module 'koa' {
  // quick and dirty fix for no await-busboy types
  interface Request {
    parts?: { field: { [k: string]: string } };
  }
}

declare module 'koa-session' {
  interface Session {
    user?: string;
  }
}
