process.env.NODE_ENV ??= "development";

import { ApplicationCommandRegistries, RegisterBehavior } from "@sapphire/framework";
import "@sapphire/plugin-logger/register";
import { join } from "node:path";
import { setup } from "@skyra/env-utilities";
import * as colorette from "colorette";

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

setup({ path: join(__dirname, "../.env") });

colorette.createColors({ useColor: true });
