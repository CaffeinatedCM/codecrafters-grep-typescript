import { Effect } from 'effect';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { program } from './main';

BunRuntime.runMain(program(process.argv).pipe(Effect.provide(BunContext.layer)), { disableErrorReporting: true });