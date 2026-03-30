import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import adminUsersRouter from "./admin-users.router";
import meRouter from "./me.router";

const users = new Hono<HonoEnv>();

users.route("/", adminUsersRouter);
users.route("/", meRouter);

export default users;
