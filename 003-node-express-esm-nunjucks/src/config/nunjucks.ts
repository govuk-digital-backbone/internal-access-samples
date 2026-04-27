import type express from "express";
import nunjucks from "nunjucks";

export function configureNunjucks(
  app: express.Application,
  viewsPath: string[],
): nunjucks.Environment {
  const nunjucksEnv: nunjucks.Environment = nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app,
  });

  return nunjucksEnv;
}
