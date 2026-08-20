// Standalone entry point spawned as a real child process by the "process actually
// exits" regression test. It must not call process.exit(): a clean natural exit
// is the thing under test.
import { closeRedis } from '../../../../src/helpers/redis';

closeRedis().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
