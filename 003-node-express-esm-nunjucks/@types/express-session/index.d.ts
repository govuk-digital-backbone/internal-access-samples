import "express-session";
import type { UserSession } from "../../src/types.ts";

declare module "express-session" {
  interface SessionData {
    user?: UserSession;
    signed_in: boolean;
    oidc_state: string;
    oidc_nonce: string;
    redirect_uri: string;
  }
}
