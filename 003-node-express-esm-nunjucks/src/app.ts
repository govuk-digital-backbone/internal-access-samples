import express from "express";
import { indexRouter } from "./routes/index.js";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import { configureNunjucks } from "./config/nunjucks.js";
import session from "express-session";
import cookieParser from "cookie-parser";
import UID from "uid-safe";

const directory_name = dirname(fileURLToPath(import.meta.url));

const APP_VIEWS = [path.join(directory_name, "views")];
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_EXPIRY = Number(process.env.SESSION_EXPIRY) || 3600000;

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = express();

if (!CLIENT_ID || !CLIENT_SECRET || !SESSION_SECRET) {
  console.error('Missing one or more required environment variables (CLIENT_ID, CLIENT_SECRET, SESSION_SECRET).');
  process.exit(1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set('trust proxy', 1);
app.set("view engine", configureNunjucks(app, APP_VIEWS));

app.use(cookieParser());

const SESSION_COOKIE_NAME = "aps";
// Generate a new session ID asynchronously if no session cookie
// `express-session` does not support async session ID generation
// https://github.com/expressjs/session/issues/107
app.use(async (req, res, next) => {
  if (!req.cookies?.[SESSION_COOKIE_NAME]) {
    req.generatedSessionId = await UID(24);
  }
  next();
});

const sessionStore = undefined;

app.use(
session({
  name: SESSION_COOKIE_NAME,
  store: sessionStore,
  saveUninitialized: false,
  secret: SESSION_SECRET!,
  unset: "destroy",
  resave: false,
  cookie: {
    maxAge: SESSION_EXPIRY,
    signed: true,
    secure: false,
  },
  // Use the newly generated session ID, or fall back to the default behaviour
  genid: (req) => {
    const sessionId = req.generatedSessionId || UID.sync(24);
    delete req.generatedSessionId;
    return sessionId;
  },
})
);

app.use("/", indexRouter);

app.get("/healthcheck", function (_request, reply) {
  reply.send("ok");
  return reply;
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

export { app };
