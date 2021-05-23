import { Joi } from 'koa-joi-router';

export type Document = {
  _id: string;
  createdAt?: Date;
  updatedAt?: Date;
};
export type Task = {
  owner: string;
  text: string;
  due: Date;
  completed: boolean;
};
export type TaskDocument = Task & Document;
export type TaskDocumentResponse = Omit<TaskDocument, 'owner'>;

export const TaskDocumentResponseSchema = {
  text: Joi.string().required(),
  due: Joi.date().required(),
  completed: Joi.boolean().required(),
  _id: Joi.string().required(),
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required(),
};

export const GetAllTasksRequestQuerySchema = {
  completed: Joi.boolean(),
};
export type GetAllTasksResponse = {
  tasks: TaskDocumentResponse[];
};
export const GetAllTasksResponseSchema = {
  200: {
    body: {
      tasks: Joi.array().items(TaskDocumentResponseSchema).required(),
    },
  },
};

export type AddTaskRequest = {
  text: string;
  due: Date;
};
export const AddTaskRequestSchema = {
  text: Joi.string().required(),
  due: Joi.date().required(),
};
export const AddTaskResponseSchema = {
  201: {
    body: TaskDocumentResponseSchema,
  },
};

export type UpdateTaskRequestData = Partial<Task> & { _id: string };
export type UpdateTaskRequest = UpdateTaskRequestData | UpdateTaskRequestData[];
const TaskOptions = Joi.object({
  _id: Joi.string().required(),
  text: Joi.string(),
  due: Joi.date(),
  completed: Joi.boolean(),
});
export const UpdateTaskRequestSchema = [
  TaskOptions.required(),
  Joi.array().items(TaskOptions.required()),
];
export const UpdateTaskResponseSchema = {
  202: {
    body: {
      updated: Joi.number().required(),
    },
  },
};

export type DeleteTaskRequest = string | string[];
export const DeleteTaskRequestSchema = [
  Joi.string().required(),
  Joi.array().items(Joi.string().required()),
];

export type DeleteTaskResponse = {
  deleted: number;
};
export const DeleteTaskResponseSchema = {
  200: {
    body: {
      deleted: Joi.number().required(),
    },
  },
};

export type User = {
  user: string;
  pass: string;
};
export type LoginRequest = {
  user: string;
  pass: string;
};
export const LoginRequestSchema = {
  user: Joi.string().required(),
  pass: Joi.string().required(),
};
