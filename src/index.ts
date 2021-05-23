import Koa from 'koa';
import bcrypt from 'bcrypt';
import session from 'koa-session';
import createRouter from 'koa-joi-router';
import logger from 'koa-logger';
// import cors from '@koa/cors';
import Datastore from 'nedb-promises';
import {
  TASKS_DB_FILENAME,
  PORT,
  TASKS_API_PREFIX,
  USERS_DB_FILENAME,
  SESSION_CONFIG,
} from './config';
import {
  AddTaskRequest,
  AddTaskRequestSchema,
  AddTaskResponseSchema,
  DeleteTaskRequest,
  DeleteTaskRequestSchema,
  DeleteTaskResponseSchema,
  GetAllTasksRequestQuerySchema,
  GetAllTasksResponseSchema,
  LoginRequest,
  UpdateTaskRequest,
  UpdateTaskRequestData,
  UpdateTaskRequestSchema,
  UpdateTaskResponseSchema,
  Task,
  User,
  LoginRequestSchema,
  TaskDocumentResponse,
} from './types';

const app = new Koa();
app.keys = ['CHANGEME'];

const router = createRouter();
router.prefix(TASKS_API_PREFIX);

const tasksdb = Datastore.create({
  filename: TASKS_DB_FILENAME,
  autoload: true,
  timestampData: true,
});

const usersdb = Datastore.create({
  filename: USERS_DB_FILENAME,
  autoload: true,
  timestampData: true,
});

const requireLogin: Koa.Middleware = async (ctx, next) => {
  if (
    ctx.session === null ||
    (ctx.session !== null && ctx.session.user === undefined)
  )
    ctx.throw(403);

  await next();
};

router.route({
  method: 'post',
  path: '/login/',
  validate: {
    type: 'json',
    body: LoginRequestSchema,
  },
  handler: async (ctx) => {
    // await bcrypt.hash('test2', 10).then((hash) => {
    //   usersdb.insert({
    //     user: 'minch',
    //     pass: hash,
    //   });
    // });
    const { user, pass } = ctx.request.body as LoginRequest;

    const throwAuthError = () => ctx.throw(401);

    const result = await usersdb
      .findOne<User>({ user: user })
      .catch(throwAuthError);

    if (!result) {
      throwAuthError();
      return;
    }

    if (await bcrypt.compare(pass, result.pass).catch(throwAuthError)) {
      if (ctx.session) {
        ctx.session.user = user;
        console.log(`set user to ${user}`);
      } else ctx.throw('invalid session');
    } else throwAuthError();

    ctx.status = 204;
  },
});

router.route({
  method: 'post',
  path: '/logout/',
  handler: async (ctx) => {
    if (ctx.session === null) {
      ctx.throw('invalid session');
      return;
    }

    if (ctx.session.user === undefined) ctx.throw(404, 'not logged in');

    // log the user out
    delete ctx.session.user;
    ctx.status = 200;
  },
});

router.route({
  method: 'get',
  path: '/',
  validate: {
    query: GetAllTasksRequestQuerySchema,
    output: GetAllTasksResponseSchema,
  },
  handler: [
    requireLogin,
    async (ctx) => {
      const docs: TaskDocumentResponse[] = await tasksdb
        .find<Task>({ ...ctx.query, owner: ctx.session?.user }, { owner: 0 })
        // incomplete tasks come first, in ascending order of due date
        .sort({ completed: 1, due: 1 })
        .exec()
        .catch(() => ctx.throw('failed to retrieve tasks from database'));

      ctx.body = { tasks: docs };
    },
  ],
});

router.route({
  method: 'post',
  path: '/',
  validate: {
    type: 'json',
    body: AddTaskRequestSchema,
    output: AddTaskResponseSchema,
  },
  handler: [
    requireLogin,
    async (ctx) => {
      const data = ctx.request.body as AddTaskRequest;

      const doc = await tasksdb
        .insert<Task>({
          ...data,
          owner: ctx.session?.user as string, // ok because login already verified
          completed: false,
        })
        .catch(() => ctx.throw('failed to add task to tasks list'));

      // remove owner field
      ctx.body = (({
        _id,
        completed,
        due,
        text,
        createdAt,
        updatedAt,
      }: TaskDocumentResponse) => ({
        _id,
        completed,
        due,
        text,
        createdAt,
        updatedAt,
      }))(doc);
      ctx.status = 201;
    },
  ],
});

router.route({
  method: 'patch',
  path: '/',
  validate: {
    type: 'json',
    body: UpdateTaskRequestSchema,
    output: UpdateTaskResponseSchema,
  },
  handler: [
    requireLogin,
    async (ctx) => {
      let data = ctx.request.body as UpdateTaskRequest;

      let updated = 0;
      async function updateTask(t: UpdateTaskRequestData & { owner: string }) {
        updated += await tasksdb
          .update<Task>({ _id: t._id, owner: t.owner }, { $set: t })
          .catch(() => ctx.throw(`failed to update task ${t._id}`));
      }

      if (Array.isArray(data))
        await Promise.all(
          data.map((task) =>
            updateTask({ ...task, owner: ctx.session?.user as string }),
          ),
        );
      else
        await updateTask({
          ...data,
          owner: ctx.session?.user as string,
        });

      ctx.body = { updated: updated };
      ctx.status = 202;
    },
  ],
});

router.route({
  method: 'delete',
  path: '/',
  validate: {
    type: 'json',
    body: DeleteTaskRequestSchema,
    output: DeleteTaskResponseSchema,
  },
  handler: [
    requireLogin,
    async (ctx) => {
      const data = ctx.request.body as DeleteTaskRequest;

      const deleted = await tasksdb
        .remove(
          Array.isArray(data)
            ? {
                $or: data.map((elt) => ({
                  _id: elt,
                  owner: ctx.session?.user,
                })),
              }
            : { _id: data, owner: ctx.session?.user },
          { multi: true },
        )
        .catch(() => ctx.throw('failed to delete task'));

      ctx.body = { deleted: deleted };
    },
  ],
});

// Error handling
app.use(async (ctx, next) => {
  if (ctx.path === '/favicon.ico') return;

  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = err.message;
    ctx.app.emit('error', err, ctx);
  }
});

app.use(logger());
app.use(session(SESSION_CONFIG(app), app));
// app.use(
//   // TODO make this less permissive in prod
//   cors({
//     origin: (ctx) =>
//       app.env === 'production' ? 'FIXME' : ctx.request.headers.origin || '',
//   }),
// );
app.use(router.middleware());

app.on('error', (err) => {
  console.error('!!! AN ERROR OCCURRED !!!');
  console.error(err.name);
});

app.listen(PORT, () => {
  console.log(`Koa server listening on port ${PORT}`);
  console.log(`Environment: ${app.env}`);
  console.log(`\tVisit:  http://127.0.0.1:${PORT}${TASKS_API_PREFIX}`);
});
